package com.lifeorganizer.gym;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** Marks a workout day as completed. */
public record WorkoutLogRequest(@NotNull UUID workoutDayId) {
}
