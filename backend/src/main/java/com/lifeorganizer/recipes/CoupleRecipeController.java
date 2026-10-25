package com.lifeorganizer.recipes;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController @Profile("couples") @RequestMapping("/api/recipes")
public class CoupleRecipeController {
    private final CoupleRecipeService recipes;public CoupleRecipeController(CoupleRecipeService recipes){this.recipes=recipes;}
    @GetMapping public List<RecipeResponse> list(@AuthenticationPrincipal User user,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size,@RequestParam(defaultValue="")String q){return recipes.list(user,page,size,q);}
    @GetMapping("/{id}") public RecipeResponse get(@AuthenticationPrincipal User user,@PathVariable UUID id){return recipes.get(user,id);}
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public RecipeResponse create(@AuthenticationPrincipal User user,@Valid @RequestBody RecipeRequest body,@RequestHeader(value="Idempotency-Key",required=false)UUID key){return recipes.create(user,body,key==null?UUID.randomUUID():key);}
    @PutMapping("/{id}") public RecipeResponse update(@AuthenticationPrincipal User user,@PathVariable UUID id,@Valid @RequestBody RecipeRequest body){return recipes.update(user,id,body);}
    @PatchMapping("/{id}/status") public RecipeResponse status(@AuthenticationPrincipal User user,@PathVariable UUID id,@Valid @RequestBody RecipeRequest.StatusRequest body){return recipes.status(user,id,body.status());}
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal User user,@PathVariable UUID id){recipes.delete(user,id);}
}
