package com.lifeorganizer.recipes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface RecipeRepository extends JpaRepository<Recipe, UUID> {
    List<Recipe> findAllByOrderByCreatedAtDescIdDesc();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select r from Recipe r where r.id = :id")
    Optional<Recipe> lockById(UUID id);
}
