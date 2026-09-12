package com.lifeorganizer.notes;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.UserRepository;
import com.lifeorganizer.push.PushService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * Business logic for notes. Creating a note with no {@code scheduledFor} sends
 * it immediately (status SENT + push); with a future hour it's held as
 * SCHEDULED until the hourly worker delivers it.
 *
 * Per the notes module spec: V1 allows at most one scheduled note per hour
 * slot, admin notes cannot be edited (only cancelled before delivery), and the
 * recipient must only ever be able to see delivered (SENT) notes — that
 * filtering happens here, server-side, not in the client.
 */
@Service
public class NoteService {

    private static final Logger log = LoggerFactory.getLogger(NoteService.class);

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final PushService pushService;

    @PersistenceContext
    private EntityManager entityManager;

    public NoteService(NoteRepository noteRepository,
                       UserRepository userRepository,
                       PushService pushService) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.pushService = pushService;
    }

    @Transactional
    public NoteResponse create(NoteRequest request) {
        boolean immediate = request.scheduledFor() == null;

        if (!immediate) {
            validateScheduleSlot(request.scheduledFor());
        }

        NoteStatus status = immediate ? NoteStatus.SENT : NoteStatus.SCHEDULED;
        Note note = new Note(request.content(), request.audioUrl(), status, request.scheduledFor());

        if (immediate) {
            note.setSentAt(Instant.now());
        }

        noteRepository.save(note);

        if (immediate) {
            deliverPush(note);
        }

        return NoteResponse.from(note);
    }

    private void validateScheduleSlot(Instant scheduledFor) {
        if (!scheduledFor.isAfter(Instant.now())) {
            throw new IllegalStateException("Past hours cannot be scheduled.");
        }
        if (noteRepository.existsByStatusAndScheduledFor(NoteStatus.SCHEDULED, scheduledFor)) {
            throw new IllegalStateException("This hour already has a scheduled note. Choose another hour.");
        }
    }

    /**
     * Notes feed. The RECIPIENT only ever receives delivered (SENT) notes,
     * newest delivered first — scheduled/draft/cancelled notes never leave
     * the server for that role. The OWNER sees their full workspace
     * (scheduled + sent) so they can manage upcoming and past notes.
     */
    @Transactional(readOnly = true)
    public List<NoteResponse> list(Role callerRole, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);

        List<Note> notes = callerRole == Role.RECIPIENT
                ? noteRepository.findByStatusOrderBySentAtDesc(NoteStatus.SENT, pageable)
                : noteRepository.findByStatusInOrderByCreatedAtDesc(
                        List.of(NoteStatus.SCHEDULED, NoteStatus.SENT), pageable);

        return notes.stream().map(NoteResponse::from).toList();
    }

    /** Cancel a scheduled note before it's delivered. A sent note can never be cancelled. */
    @Transactional
    public void cancel(UUID id) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Note not found"));

        if (note.getStatus() != NoteStatus.SCHEDULED) {
            throw new IllegalStateException("Only a scheduled note can be cancelled.");
        }

        note.setStatus(NoteStatus.CANCELLED);
        noteRepository.save(note);
    }

    /**
     * Atomically claims at most one due scheduled note (the earliest by
     * {@code scheduledFor}) and flips it to SENT, so two overlapping worker
     * runs can never deliver the same note twice. Uses {@code FOR UPDATE SKIP
     * LOCKED} so a concurrent run skips a row already being claimed rather
     * than blocking on it.
     */
    @Transactional
    public Optional<UUID> claimNextDueNote() {
        List<?> result = entityManager.createNativeQuery("""
                UPDATE notes
                SET status = 'SENT', sent_at = now()
                WHERE id = (
                    SELECT id FROM notes
                    WHERE status = 'SCHEDULED' AND scheduled_for <= now()
                    ORDER BY scheduled_for ASC
                    LIMIT 1
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id
                """).getResultList();

        if (result.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of((UUID) result.get(0));
    }

    /** Sends the push for a just-claimed (now SENT) note and records the outcome. */
    @Transactional
    public void deliverClaimedNote(UUID noteId) {
        Note note = noteRepository.findById(noteId)
                .orElseThrow(() -> new NoSuchElementException("Note not found"));
        deliverPush(note);
        log.info("Delivered scheduled note {}", note.getId());
    }

    /**
     * Fires the push and records the outcome on {@code notificationStatus} —
     * kept independent of the note's own SENT status so a push failure never
     * causes the note to be resent or duplicated.
     */
    private void deliverPush(Note note) {
        boolean sent = userRepository.findByRole(Role.RECIPIENT)
                .map(recipient -> pushService.sendToUser(recipient, "A note for you 💌", note.getContent()))
                .orElse(false);

        note.setNotificationStatus(sent ? NotificationStatus.SENT : NotificationStatus.FAILED);
        note.setNotificationSentAt(Instant.now());
        noteRepository.save(note);
    }
}
