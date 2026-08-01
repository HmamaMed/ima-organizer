package com.lifeorganizer.notes;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * Payload for creating a note. If {@code scheduledFor} is null the note is sent
 * immediately; otherwise it's held as SCHEDULED until that time.
 */
public record NoteRequest(
        @NotBlank @Size(max = 4000) String content,
        String audioUrl,
        Instant scheduledFor) {
}
