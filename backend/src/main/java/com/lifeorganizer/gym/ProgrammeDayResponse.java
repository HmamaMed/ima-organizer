package com.lifeorganizer.gym;

import java.util.List;
import java.util.UUID;

public record ProgrammeDayResponse(
        UUID id,
        String label,
        String coachNote,
        List<DayExerciseResponse> exercises) {

    public static ProgrammeDayResponse from(ProgrammeDay day) {
        return new ProgrammeDayResponse(
                day.getId(),
                day.getLabel(),
                day.getCoachNote(),
                day.getExercises().stream().map(DayExerciseResponse::from).toList());
    }
}
