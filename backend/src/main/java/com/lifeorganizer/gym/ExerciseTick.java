package com.lifeorganizer.gym;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One exercise ticked off on one day, by one person.
 *
 * {@code tickDate} is the *client's* local date rather than something derived
 * from {@code completedAt} on the server: the backend runs in UTC and the
 * phone doesn't, so a late-evening session would otherwise land on the wrong
 * day. Sending the local date makes tick and untick exact lookups with no
 * timezone maths anywhere.
 */
@Entity
@Table(name = "exercise_ticks")
public class ExerciseTick {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID dayExerciseId;

    @Column(nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private LocalDate tickDate;

    @Column(nullable = false)
    private Instant completedAt;

    protected ExerciseTick() {
        // for JPA
    }

    public ExerciseTick(UUID dayExerciseId, UUID userId, LocalDate tickDate) {
        this.dayExerciseId = dayExerciseId;
        this.userId = userId;
        this.tickDate = tickDate;
        this.completedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getDayExerciseId() {
        return dayExerciseId;
    }

    public UUID getUserId() {
        return userId;
    }

    public LocalDate getTickDate() {
        return tickDate;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
