package com.lifeorganizer.gym;

import java.time.Instant;
import java.util.UUID;

public record WorkoutLogResponse(
        UUID id,
        UUID workoutDayId,
        Instant completedAt) {

    public static WorkoutLogResponse from(WorkoutLog log) {
        return new WorkoutLogResponse(log.getId(), log.getWorkoutDayId(), log.getCompletedAt());
    }
}
