package com.lifeorganizer.memories;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Payload for creating a memory. The photo is uploaded to media storage by
 * the client first; this endpoint receives just the resulting URL + metadata.
 */
public record MemoryRequest(
        @NotBlank String photoUrl,
        String caption,
        String audioUrl,
        @NotNull LocalDate memoryDate,
        UUID groupId) {
}
