package com.lifeorganizer.memories;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MemoryGroupRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 500) String description) {}
