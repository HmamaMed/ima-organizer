package com.lifeorganizer.memories;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A memory in the timeline. The photo is uploaded directly to Firebase Storage
 * from the client; the backend only stores the resulting URL plus metadata.
 */
@Entity
@Table(name = "memories")
public class Memory {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String photoUrl;

    @Column
    private String caption;

    /** Optional audio URL in Firebase Storage. */
    @Column
    private String audioUrl;

    /** The date the memory happened — used for ordering the timeline. */
    @Column(nullable = false)
    private LocalDate memoryDate;

    @Column(nullable = false)
    private Instant createdAt;

    protected Memory() {
        // for JPA
    }

    public Memory(String photoUrl, String caption, String audioUrl, LocalDate memoryDate) {
        this.photoUrl = photoUrl;
        this.caption = caption;
        this.audioUrl = audioUrl;
        this.memoryDate = memoryDate;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public LocalDate getMemoryDate() {
        return memoryDate;
    }

    public void setMemoryDate(LocalDate memoryDate) {
        this.memoryDate = memoryDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
