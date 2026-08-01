package com.lifeorganizer.memories;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record MemoryResponse(
        UUID id,
        String photoUrl,
        String caption,
        String audioUrl,
        LocalDate memoryDate,
        Instant createdAt) {

    public static MemoryResponse from(Memory memory) {
        return new MemoryResponse(
                memory.getId(),
                memory.getPhotoUrl(),
                memory.getCaption(),
                memory.getAudioUrl(),
                memory.getMemoryDate(),
                memory.getCreatedAt());
    }
}
