package com.lifeorganizer.gym;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * A single exercise within a workout day.
 */
@Entity
@Table(name = "exercises")
public class Exercise {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "workout_day_id", nullable = false)
    private WorkoutDay workoutDay;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private int sets;

    /** String, not int — supports "12", "30 sec", or "AMRAP". */
    @Column(nullable = false)
    private String reps;

    @Column(nullable = false, length = 2000)
    private String instructions;

    @Column
    private String videoUrl;

    /** Position within the workout day — set by {@link WorkoutDay#addExercise}. */
    @Column(nullable = false)
    private int sortOrder;

    protected Exercise() {
        // for JPA
    }

    public Exercise(String name, int sets, String reps, String instructions, String videoUrl) {
        this.name = name;
        this.sets = sets;
        this.reps = reps;
        this.instructions = instructions;
        this.videoUrl = videoUrl;
    }

    public UUID getId() {
        return id;
    }

    public WorkoutDay getWorkoutDay() {
        return workoutDay;
    }

    public void setWorkoutDay(WorkoutDay workoutDay) {
        this.workoutDay = workoutDay;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getSets() {
        return sets;
    }

    public void setSets(int sets) {
        this.sets = sets;
    }

    public String getReps() {
        return reps;
    }

    public void setReps(String reps) {
        this.reps = reps;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public void setVideoUrl(String videoUrl) {
        this.videoUrl = videoUrl;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
