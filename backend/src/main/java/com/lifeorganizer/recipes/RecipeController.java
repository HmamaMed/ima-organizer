package com.lifeorganizer.recipes;

import org.springframework.context.annotation.Profile;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/recipes")
@Profile("!couples")
public class RecipeController {
    private final RecipeService service;
    public RecipeController(RecipeService service) { this.service = service; }
    @GetMapping public List<RecipeResponse> list() { return service.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public RecipeResponse create(@Valid @RequestBody RecipeRequest request) { return service.create(request); }
    @PutMapping("/{id}") public RecipeResponse update(@PathVariable UUID id, @Valid @RequestBody RecipeRequest request) { return service.update(id, request); }
    @PatchMapping("/{id}/status") public RecipeResponse status(@PathVariable UUID id, @Valid @RequestBody RecipeRequest.StatusRequest request) { return service.status(id, request.status()); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id) { service.delete(id); }
}
