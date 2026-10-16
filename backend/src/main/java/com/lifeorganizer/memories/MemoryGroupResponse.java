package com.lifeorganizer.memories;

import java.time.Instant;
import java.util.UUID;

public record MemoryGroupResponse(UUID id, String name, String description, Instant createdAt, Instant expiresAt) {
    public static MemoryGroupResponse from(MemoryGroup group) {
        return new MemoryGroupResponse(group.getId(), group.getName(), group.getDescription(), group.getCreatedAt(), group.getExpiresAt());
    }
}
