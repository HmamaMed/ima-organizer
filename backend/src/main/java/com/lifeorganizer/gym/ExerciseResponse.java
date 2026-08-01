package com.lifeorganizer.gym;

import java.util.UUID;

public record ExerciseResponse(
        UUID id,
        String name,
        int sets,
        String reps,
        String instructions,
        String videoUrl) {

    public static ExerciseResponse from(Exercise exercise) {
        return new ExerciseResponse(
                exercise.getId(),
                exercise.getName(),
                exercise.getSets(),
                exercise.getReps(),
                exercise.getInstructions(),
                exercise.getVideoUrl());
    }
}
