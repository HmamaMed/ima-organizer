package com.lifeorganizer.gym;

import java.util.List;
import java.util.UUID;

public record WorkoutDayResponse(
        UUID id,
        String dayLabel,
        String notes,
        List<ExerciseResponse> exercises) {

    public static WorkoutDayResponse from(WorkoutDay day) {
        return new WorkoutDayResponse(
                day.getId(),
                day.getDayLabel(),
                day.getNotes(),
                day.getExercises().stream().map(ExerciseResponse::from).toList());
    }
}
