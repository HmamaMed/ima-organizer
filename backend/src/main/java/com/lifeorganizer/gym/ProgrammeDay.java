package com.lifeorganizer.gym;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * One session within a programme, e.g. "Day 1 — Legs &amp; Core". Days are not
 * pinned to weekdays: she opens whichever she feels like and repeats them, so a
 * missed day never leaves a hole in the plan.
 */
@Entity
@Table(name = "programme_days")
public class ProgrammeDay {

    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "programme_id", nullable = false)
    private Programme programme;

    @Column(nullable = false)
    private String label;

    /** A line from the owner shown at the top of the session — the gift part. */
    @Column(length = 500)
    private String coachNote;

    @Column(nullable = false)
    private int sortOrder;

    @OneToMany(mappedBy = "programmeDay", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<DayExercise> exercises = new ArrayList<>();

    protected ProgrammeDay() {
        // for JPA
    }

    public ProgrammeDay(String label, String coachNote) {
        this.label = label;
        this.coachNote = coachNote;
    }

    public UUID getId() {
        return id;
    }

    public Programme getProgramme() {
        return programme;
    }

    public void setProgramme(Programme programme) {
        this.programme = programme;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public String getCoachNote() {
        return coachNote;
    }

    public void setCoachNote(String coachNote) {
        this.coachNote = coachNote;
    }

    public int getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(int sortOrder) {
        this.sortOrder = sortOrder;
    }

    public List<DayExercise> getExercises() {
        return exercises;
    }

    public void addExercise(DayExercise exercise) {
        exercise.setSortOrder(exercises.size());
        exercise.setProgrammeDay(this);
        exercises.add(exercise);
    }

    /** Drops every assignment on this day — used when the owner re-saves the list wholesale. */
    public void clearExercises() {
        exercises.clear();
    }
}
