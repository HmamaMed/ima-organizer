package com.lifeorganizer.gym;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/**
 * A reusable exercise in the library — the *what* (how a squat is performed,
 * what it looks like), never the *how much*.
 *
 * Sets and reps deliberately do not live here: the same exercise is prescribed
 * at different volumes on different days, so that belongs on
 * {@link DayExercise}, the assignment. Keeping them apart is what makes
 * "build a day by picking exercises you already wrote" possible.
 */
@Entity
@Table(name = "library_exercises")
public class LibraryExercise {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    /** Usually a URL pasted from the web rather than an upload. */
    @Column(length = 1000)
    private String imageUrl;

    @Column(length = 1000)
    private String videoUrl;

    @Column(nullable = false, length = 2000)
    private String instructions;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MuscleGroup muscleGroup;

    @Column(nullable = false)
    private Instant createdAt;

    protected LibraryExercise() {
        // for JPA
    }

    public LibraryExercise(String name, String imageUrl, String videoUrl, String instructions, MuscleGroup muscleGroup) {
        this.name = name;
        this.imageUrl = imageUrl;
        this.videoUrl = videoUrl;
        this.instructions = instructions;
        this.muscleGroup = muscleGroup;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getVideoUrl() {
        return videoUrl;
    }

    public void setVideoUrl(String videoUrl) {
        this.videoUrl = videoUrl;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public MuscleGroup getMuscleGroup() {
        return muscleGroup;
    }

    public void setMuscleGroup(MuscleGroup muscleGroup) {
        this.muscleGroup = muscleGroup;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
