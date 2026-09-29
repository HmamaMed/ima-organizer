package com.lifeorganizer.gym;

import java.util.List;
import java.util.UUID;

public record ProgrammeResponse(
        UUID id,
        String name,
        String description,
        boolean active,
        List<ProgrammeDayResponse> days) {

    public static ProgrammeResponse from(Programme programme) {
        return new ProgrammeResponse(
                programme.getId(),
                programme.getName(),
                programme.getDescription(),
                programme.isActive(),
                programme.getDays().stream().map(ProgrammeDayResponse::from).toList());
    }
}
