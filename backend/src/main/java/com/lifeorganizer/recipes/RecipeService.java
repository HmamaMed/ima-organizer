package com.lifeorganizer.recipes;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class RecipeService {
    private final RecipeRepository recipes;
    public RecipeService(RecipeRepository recipes) { this.recipes = recipes; }
    public List<RecipeResponse> list() { return recipes.findAllByOrderByCreatedAtDescIdDesc().stream().map(RecipeResponse::from).toList(); }
    @Transactional
    public RecipeResponse create(RecipeRequest request) { Recipe recipe = new Recipe(Instant.now()); recipe.update(request); return RecipeResponse.from(recipes.saveAndFlush(recipe)); }
    @Transactional
    public RecipeResponse update(UUID id, RecipeRequest request) { Recipe recipe = find(id); recipe.update(request); return RecipeResponse.from(recipe); }
    @Transactional
    public RecipeResponse status(UUID id, Recipe.Status status) { Recipe recipe = find(id); recipe.setStatus(status); return RecipeResponse.from(recipe); }
    @Transactional
    public void delete(UUID id) { recipes.delete(find(id)); }
    private Recipe find(UUID id) { return recipes.lockById(id).orElseThrow(() -> new NoSuchElementException("Recette introuvable.")); }
}
