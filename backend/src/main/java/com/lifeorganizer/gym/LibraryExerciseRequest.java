package com.lifeorganizer.gym;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Create/update payload for a library exercise. Images are pasted URLs, not uploads. */
public record LibraryExerciseRequest(
        @NotBlank String name,
        String imageUrl,
        String videoUrl,
        @NotBlank String instructions,
        @NotNull MuscleGroup muscleGroup) {
}
