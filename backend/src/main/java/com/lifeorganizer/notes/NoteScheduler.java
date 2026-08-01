package com.lifeorganizer.notes;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.UserRepository;
import com.lifeorganizer.push.PushService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

/**
 * Polls every 60 seconds for SCHEDULED notes whose {@code scheduledFor} has
 * arrived, flips them to SENT, and fires the push to the recipient.
 */
@Component
public class NoteScheduler {

    private static final Logger log = LoggerFactory.getLogger(NoteScheduler.class);

    private final NoteRepository noteRepository;
    private final UserRepository userRepository;
    private final PushService pushService;

    public NoteScheduler(NoteRepository noteRepository,
                         UserRepository userRepository,
                         PushService pushService) {
        this.noteRepository = noteRepository;
        this.userRepository = userRepository;
        this.pushService = pushService;
    }

    @Scheduled(fixedDelay = 60_000)
    @Transactional
    public void sendDueNotes() {
        List<Note> due = noteRepository.findByStatusAndScheduledForLessThanEqual(
                NoteStatus.SCHEDULED, Instant.now());

        if (due.isEmpty()) {
            return;
        }

        for (Note note : due) {
            note.setStatus(NoteStatus.SENT);
            note.setSentAt(Instant.now());
            noteRepository.save(note);

            userRepository.findByRole(Role.RECIPIENT).ifPresent(recipient ->
                    pushService.sendToUser(recipient, "A note for you 💌", note.getContent()));

            log.info("Sent scheduled note {}", note.getId());
        }
    }
}
