package com.lifeorganizer.gym;

import jakarta.validation.constraints.NotBlank;

/** Create/update payload for a programme. {@code active} switches which one she sees. */
public record ProgrammeRequest(
        @NotBlank String name,
        String description,
        Boolean active) {
}
