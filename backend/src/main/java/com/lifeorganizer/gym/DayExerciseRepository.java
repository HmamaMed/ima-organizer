package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DayExerciseRepository extends JpaRepository<DayExercise, UUID> {

    /** Guards deletion of a library exercise that's still prescribed somewhere. */
    boolean existsByExerciseId(UUID exerciseId);
}
