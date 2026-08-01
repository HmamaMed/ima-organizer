package com.lifeorganizer.notes;

import java.time.Instant;
import java.util.UUID;

public record NoteResponse(
        UUID id,
        String content,
        String audioUrl,
        NoteStatus status,
        Instant scheduledFor,
        Instant sentAt,
        Instant createdAt) {

    public static NoteResponse from(Note note) {
        return new NoteResponse(
                note.getId(),
                note.getContent(),
                note.getAudioUrl(),
                note.getStatus(),
                note.getScheduledFor(),
                note.getSentAt(),
                note.getCreatedAt());
    }
}
