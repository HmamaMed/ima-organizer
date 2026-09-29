package com.lifeorganizer.gym;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ExerciseTickResponse(
        UUID id,
        UUID dayExerciseId,
        UUID userId,
        LocalDate tickDate,
        Instant completedAt) {

    public static ExerciseTickResponse from(ExerciseTick tick) {
        return new ExerciseTickResponse(
                tick.getId(),
                tick.getDayExerciseId(),
                tick.getUserId(),
                tick.getTickDate(),
                tick.getCompletedAt());
    }
}
