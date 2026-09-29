package com.lifeorganizer.gym;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** Marks a whole session as completed. */
public record WorkoutLogRequest(@NotNull UUID programmeDayId) {
}
