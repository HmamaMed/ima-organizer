package com.lifeorganizer.gym;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

/**
 * Replaces a day's whole exercise list in one call.
 *
 * Wholesale replacement rather than add/remove/reorder endpoints: the builder
 * screen already holds the full ordered list in memory, so one PUT keeps both
 * sides trivial and makes ordering impossible to get out of sync.
 */
public record DayExercisesRequest(@NotNull @Valid List<Entry> exercises) {

    public record Entry(
            @NotNull UUID exerciseId,
            @Min(1) int sets,
            @NotBlank String reps,
            Integer restSeconds,
            String note) {
    }
}
