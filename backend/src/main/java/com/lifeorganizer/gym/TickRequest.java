package com.lifeorganizer.gym;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Ticks or unticks one exercise for one day. {@code tickDate} is the phone's
 * local date — see {@link ExerciseTick} for why the server doesn't derive it.
 */
public record TickRequest(
        @NotNull UUID dayExerciseId,
        @NotNull LocalDate tickDate,
        boolean done) {
}
