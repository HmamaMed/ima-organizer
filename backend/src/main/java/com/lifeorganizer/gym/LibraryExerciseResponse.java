package com.lifeorganizer.gym;

import java.util.UUID;

public record LibraryExerciseResponse(
        UUID id,
        String name,
        String imageUrl,
        String videoUrl,
        String instructions,
        MuscleGroup muscleGroup) {

    public static LibraryExerciseResponse from(LibraryExercise exercise) {
        return new LibraryExerciseResponse(
                exercise.getId(),
                exercise.getName(),
                exercise.getImageUrl(),
                exercise.getVideoUrl(),
                exercise.getInstructions(),
                exercise.getMuscleGroup());
    }
}
