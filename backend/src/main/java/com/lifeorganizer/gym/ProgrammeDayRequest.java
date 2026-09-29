package com.lifeorganizer.gym;

import jakarta.validation.constraints.NotBlank;

/** Create/update payload for a day within a programme. */
public record ProgrammeDayRequest(
        @NotBlank String label,
        String coachNote) {
}
