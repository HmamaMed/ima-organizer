package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkoutDayRepository extends JpaRepository<WorkoutDay, UUID> {

    /** Plan ordered by insertion order. */
    List<WorkoutDay> findAllByOrderByIdAsc();
}
