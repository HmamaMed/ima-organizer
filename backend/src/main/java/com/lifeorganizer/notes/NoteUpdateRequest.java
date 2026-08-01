package com.lifeorganizer.notes;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

/**
 * Payload for editing a note before it's sent. Only content and the schedule
 * can change; a note that's already SENT cannot be edited.
 */
public record NoteUpdateRequest(
        @NotBlank @Size(max = 4000) String content,
        String audioUrl,
        Instant scheduledFor) {
}
