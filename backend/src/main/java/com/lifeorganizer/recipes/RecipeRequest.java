package com.lifeorganizer.recipes;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public record RecipeRequest(@NotBlank @Size(max = 150) String title,
                            @NotNull Recipe.Status status,
                            @NotNull @Min(1) @Max(50) Integer servings,
                            @Min(1) @Max(1440) Integer minutes,
                            @NotEmpty @Size(max = 100) List<@NotNull @Valid Ingredient> ingredients,
                            @NotEmpty @Size(max = 40) List<@NotBlank @Size(max = 2000) String> steps,
                            @Size(max = 2000) String tips) {
    public record Ingredient(@NotBlank @Size(max = 120) String name, @Size(max = 80) String amount) {}
    public record StatusRequest(@NotNull Recipe.Status status) {}
}
