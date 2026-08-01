package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WorkoutLogRepository extends JpaRepository<WorkoutLog, UUID> {

    /** Completion history, newest first. */
    List<WorkoutLog> findAllByOrderByCompletedAtDesc();
}
