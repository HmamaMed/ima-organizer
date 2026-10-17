package com.lifeorganizer.recipes;

import jakarta.persistence.*;

/** Separate name/amount fields preserve ingredients for a future shopping-list feature. */
@Embeddable
public class RecipeIngredient {
    @Column(name = "ingredient_name", nullable = false, length = 120) private String name;
    @Column(name = "amount", length = 80) private String amount;
    protected RecipeIngredient() {}
    public RecipeIngredient(String name, String amount) { this.name = name.trim(); this.amount = amount == null || amount.isBlank() ? null : amount.trim(); }
    public String getName() { return name; }
    public String getAmount() { return amount; }
}
