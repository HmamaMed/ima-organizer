package com.lifeorganizer.gym;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Marks a workout day as completed — used for a simple streak/consistency view.
 */
@Entity
@Table(name = "workout_logs")
public class WorkoutLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID workoutDayId;

    @Column(nullable = false)
    private Instant completedAt;

    protected WorkoutLog() {
        // for JPA
    }

    public WorkoutLog(UUID workoutDayId, Instant completedAt) {
        this.workoutDayId = workoutDayId;
        this.completedAt = completedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getWorkoutDayId() {
        return workoutDayId;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
