package com.lifeorganizer.notes;

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
 * A note from the OWNER to the RECIPIENT. Sent immediately on creation if no
 * {@code scheduledFor} is set, otherwise held as SCHEDULED until the scheduler
 * fires.
 */
@Entity
@Table(name = "notes")
public class Note {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 4000)
    private String content;

    /** Optional, for future voice-note support. */
    @Column
    private String audioUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NoteStatus status;

    @Column
    private Instant scheduledFor;

    @Column
    private Instant sentAt;

    @Column(nullable = false)
    private Instant createdAt;

    protected Note() {
        // for JPA
    }

    public Note(String content, String audioUrl, NoteStatus status, Instant scheduledFor) {
        this.content = content;
        this.audioUrl = audioUrl;
        this.status = status;
        this.scheduledFor = scheduledFor;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public NoteStatus getStatus() {
        return status;
    }

    public void setStatus(NoteStatus status) {
        this.status = status;
    }

    public Instant getScheduledFor() {
        return scheduledFor;
    }

    public void setScheduledFor(Instant scheduledFor) {
        this.scheduledFor = scheduledFor;
    }

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
