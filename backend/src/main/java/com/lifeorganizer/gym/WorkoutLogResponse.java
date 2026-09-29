package com.lifeorganizer.gym;

import java.time.Instant;
import java.util.UUID;

public record WorkoutLogResponse(
        UUID id,
        UUID programmeDayId,
        UUID userId,
        Instant completedAt) {

    public static WorkoutLogResponse from(WorkoutLog log) {
        return new WorkoutLogResponse(
                log.getId(),
                log.getProgrammeDayId(),
                log.getUserId(),
                log.getCompletedAt());
    }
}
