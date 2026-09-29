package com.lifeorganizer.gym;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * Marks a whole session as completed — the source for streaks and the weekly
 * strip.
 *
 * Two migration-shaped details, both deliberate:
 * <ul>
 *   <li>The column stays {@code workout_day_id} while the field is named for
 *       what it now points at (a {@link ProgrammeDay}). {@code ddl-auto:
 *       update} never drops columns, so renaming it would leave the old
 *       NOT NULL column behind and every insert would fail.</li>
 *   <li>{@code userId} is nullable: the table already has rows from before
 *       there was a user on it, and Postgres rejects adding a NOT NULL column
 *       to a populated table. Rows written from here always set it; a null
 *       just means "logged before we tracked who".</li>
 * </ul>
 */
@Entity
@Table(name = "workout_logs")
public class WorkoutLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "workout_day_id", nullable = false)
    private UUID programmeDayId;

    @Column
    private UUID userId;

    @Column(nullable = false)
    private Instant completedAt;

    protected WorkoutLog() {
        // for JPA
    }

    public WorkoutLog(UUID programmeDayId, UUID userId, Instant completedAt) {
        this.programmeDayId = programmeDayId;
        this.userId = userId;
        this.completedAt = completedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getProgrammeDayId() {
        return programmeDayId;
    }

    public UUID getUserId() {
        return userId;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
