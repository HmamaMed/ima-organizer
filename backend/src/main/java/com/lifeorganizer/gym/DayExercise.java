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
 * One exercise as prescribed on one day — the assignment, not the exercise.
 *
 * This is where sets/reps/rest live, because "squats" is 3×15 on Day 1 and
 * 4×10 on Day 3 while still being the same library entry with the same
 * instructions and image.
 */
@Entity
@Table(name = "day_exercises")
public class DayExercise {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programme_day_id", nullable = false)
    private ProgrammeDay programmeDay;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "library_exercise_id", nullable = false)
    private LibraryExercise exercise;

    @Column(nullable = false)
    private int sets;

    /** String, not int — supports "12", "30 sec", or "AMRAP". */
    @Column(nullable = false)
    private String reps;

    @Column
    private Integer restSeconds;

    /** Optional tweak for this day only, e.g. "go slow on the way down". */
    @Column(length = 500)
    private String note;

    @Column(nullable = false)
    private int sortOrder;

    protected DayExercise() {
        // for JPA
    }

    public DayExercise(LibraryExercise exercise, int sets, String reps, Integer restSeconds, String note) {
        this.exercise = exercise;
        this.sets = sets;
        this.reps = reps;
        this.restSeconds = restSeconds;
        this.note = note;
    }

    public UUID getId() {
        return id;
    }

    public ProgrammeDay getProgrammeDay() {
        return programmeDay;
    }

    public void setProgrammeDay(ProgrammeDay programmeDay) {
        this.programmeDay = programmeDay;
    }

    public LibraryExercise getExercise() {
        return exercise;
    }

    public void setExercise(LibraryExercise exercise) {
        this.exercise = exercise;
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

    public Integer getRestSeconds() {
        return restSeconds;
    }

    public void setRestSeconds(Integer restSeconds) {
        this.restSeconds = restSeconds;
    }

    public String getNote() {
        return note;
    }

    public void setNote(String note) {
        this.note = note;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }
}
