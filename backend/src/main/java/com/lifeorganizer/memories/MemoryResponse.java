package com.lifeorganizer.memories;

import java.time.*;
import java.util.UUID;

public record MemoryResponse(UUID id, String photoUrl, String caption, String audioUrl,
                             LocalDate memoryDate, Instant createdAt, UUID groupId, Instant expiresAt) {}
