package com.lifeorganizer.notes;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.UserRepository;
import com.lifeorganizer.push.PushService;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Business logic for notes. Creating a note with no {@code scheduledFor} sends
 * it immediately (status SENT + push); with a future schedule it's held as
 * SCHEDULED until the scheduler fires.
 */
@Service
public class NoteService {

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final PushService pushService;

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
        NoteStatus status = immediate ? NoteStatus.SENT : NoteStatus.SCHEDULED;

        Note note = new Note(
                request.content(),
                request.audioUrl(),
                status,
                request.scheduledFor());

        if (immediate) {
            note.setSentAt(Instant.now());
        }

        noteRepository.save(note);

        if (immediate) {
            sendPush(note);
        }

        return NoteResponse.from(note);
    }

    /** Feed, newest first, paginated. */
    @Transactional(readOnly = true)
    public List<NoteResponse> list(int page, int size) {
        return noteRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .stream()
                .map(NoteResponse::from)
                .toList();
    }

    /** Edit a note before it's sent. */
    @Transactional
    public NoteResponse update(UUID id, NoteUpdateRequest request) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Note not found"));

        if (note.getStatus() == NoteStatus.SENT) {
            throw new IllegalStateException("A sent note cannot be edited");
        }

        note.setContent(request.content());
        note.setAudioUrl(request.audioUrl());
        note.setScheduledFor(request.scheduledFor());
        note.setStatus(request.scheduledFor() == null ? NoteStatus.SENT : NoteStatus.SCHEDULED);

        if (request.scheduledFor() == null) {
            note.setSentAt(Instant.now());
        }

        noteRepository.save(note);

        if (request.scheduledFor() == null) {
            sendPush(note);
        }

        return NoteResponse.from(note);
    }

    /** Cancel a scheduled note. */
    @Transactional
    public void delete(UUID id) {
        Note note = noteRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Note not found"));
        noteRepository.delete(note);
    }

    /**
     * Fires a push to the recipient when a note is sent. Best-effort — if the
     * recipient has no token or Firebase isn't configured, it's skipped.
     */
    private void sendPush(Note note) {
        userRepository.findByRole(Role.RECIPIENT).ifPresent(recipient ->
                pushService.sendToUser(recipient, "A note for you 💌", note.getContent()));
    }
}
