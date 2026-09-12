package com.lifeorganizer.notes;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.UUID;

/**
 * Runs once per hour, at minute 0. V1 deliberately allows at most one
 * scheduled note per hour slot, so at most one note is due per run — the
 * worker claims and delivers exactly one, atomically, per the notes module
 * spec. It does not require an exact timestamp match ({@code scheduledFor <=
 * now}), so a delayed run still delivers an overdue note rather than losing it.
 */
@Component
public class NoteScheduler {

    private static final Logger log = LoggerFactory.getLogger(NoteScheduler.class);

    private final NoteService noteService;

    public NoteScheduler(NoteService noteService) {
        this.noteService = noteService;
    }

    @Scheduled(cron = "0 0 * * * *")
    public void deliverDueNote() {
        Optional<UUID> claimed = noteService.claimNextDueNote();
        if (claimed.isEmpty()) {
            return;
        }
        noteService.deliverClaimedNote(claimed.get());
    }
}
