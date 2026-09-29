package com.lifeorganizer.gym;

import java.util.UUID;

public record DayExerciseResponse(
        UUID id,
        int sets,
        String reps,
        Integer restSeconds,
        String note,
        LibraryExerciseResponse exercise) {

    public static DayExerciseResponse from(DayExercise dayExercise) {
        return new DayExerciseResponse(
                dayExercise.getId(),
                dayExercise.getSets(),
                dayExercise.getReps(),
                dayExercise.getRestSeconds(),
                dayExercise.getNote(),
                LibraryExerciseResponse.from(dayExercise.getExercise()));
    }
}
