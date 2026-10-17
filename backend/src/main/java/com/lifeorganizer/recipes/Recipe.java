package com.lifeorganizer.recipes;

import jakarta.persistence.*;
import org.hibernate.annotations.BatchSize;
import java.time.Instant;
import java.util.*;

@Entity
@Table(name = "recipes")
public class Recipe {
    public enum Status { TO_TRY, FAVORITE }
    @Id @GeneratedValue private UUID id;
    @Column(nullable = false, length = 150) private String title;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
    @Column(nullable = false) private int servings;
    private Integer minutes;
    @Column(length = 2000) private String tips;
    @Column(nullable = false) private Instant createdAt;
    @ElementCollection @CollectionTable(name = "recipe_ingredients", joinColumns = @JoinColumn(name = "recipe_id"))
    @OrderColumn(name = "ingredient_position") @BatchSize(size = 50)
    private List<RecipeIngredient> ingredients = new ArrayList<>();
    @ElementCollection @CollectionTable(name = "recipe_steps", joinColumns = @JoinColumn(name = "recipe_id"))
    @OrderColumn(name = "step_position") @Column(name = "instruction", nullable = false, length = 2000) @BatchSize(size = 50)
    private List<String> steps = new ArrayList<>();
    protected Recipe() {}
    public Recipe(Instant now) { createdAt = now; }
    public void update(RecipeRequest request) {
        title = request.title().trim(); status = request.status(); servings = request.servings(); minutes = request.minutes();
        tips = request.tips() == null || request.tips().isBlank() ? null : request.tips().trim();
        ingredients.clear(); request.ingredients().forEach(item -> ingredients.add(new RecipeIngredient(item.name(), item.amount())));
        steps.clear(); request.steps().forEach(step -> steps.add(step.trim()));
    }
    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public int getServings() { return servings; }
    public Integer getMinutes() { return minutes; }
    public String getTips() { return tips; }
    public Instant getCreatedAt() { return createdAt; }
    public List<RecipeIngredient> getIngredients() { return ingredients; }
    public List<String> getSteps() { return steps; }
}
