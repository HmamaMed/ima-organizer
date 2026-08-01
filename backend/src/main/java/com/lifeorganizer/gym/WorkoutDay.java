package com.lifeorganizer.gym;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A single day in the workout plan, e.g. "Day 1 — Legs & Core".
 */
@Entity
@Table(name = "workout_days")
public class WorkoutDay {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String dayLabel;

    @Column
    private String notes;

    @OneToMany(mappedBy = "workoutDay", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<Exercise> exercises = new ArrayList<>();

    protected WorkoutDay() {
        // for JPA
    }

    public WorkoutDay(String dayLabel, String notes) {
        this.dayLabel = dayLabel;
        this.notes = notes;
    }

    public UUID getId() {
        return id;
    }

    public String getDayLabel() {
        return dayLabel;
    }

    public void setDayLabel(String dayLabel) {
        this.dayLabel = dayLabel;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public List<Exercise> getExercises() {
        return exercises;
    }

    public void addExercise(Exercise exercise) {
        exercises.add(exercise);
        exercise.setWorkoutDay(this);
    }
}
