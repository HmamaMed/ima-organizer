package com.lifeorganizer.recipes;

import java.time.Instant;
import java.util.*;

public record RecipeResponse(UUID id, String title, Recipe.Status status, int servings, Integer minutes,
                             List<RecipeRequest.Ingredient> ingredients, List<String> steps, String tips, Instant createdAt) {
    static RecipeResponse from(Recipe recipe) {
        return new RecipeResponse(recipe.getId(), recipe.getTitle(), recipe.getStatus(), recipe.getServings(), recipe.getMinutes(),
                recipe.getIngredients().stream().map(item -> new RecipeRequest.Ingredient(item.getName(), item.getAmount())).toList(),
                List.copyOf(recipe.getSteps()), recipe.getTips(), recipe.getCreatedAt());
    }
}
