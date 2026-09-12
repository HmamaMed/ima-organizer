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
 * {@code scheduledFor} is set, otherwise held as SCHEDULED until the hourly
 * worker delivers it.
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

    /** Tracked separately from {@link #status} — a push failure must never affect note delivery. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NotificationStatus notificationStatus = NotificationStatus.PENDING;

    @Column
    private Instant notificationSentAt;

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

    public String getAudioUrl() {
        return audioUrl;
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

    public Instant getSentAt() {
        return sentAt;
    }

    public void setSentAt(Instant sentAt) {
        this.sentAt = sentAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public NotificationStatus getNotificationStatus() {
        return notificationStatus;
    }

    public void setNotificationStatus(NotificationStatus notificationStatus) {
        this.notificationStatus = notificationStatus;
    }

    public Instant getNotificationSentAt() {
        return notificationSentAt;
    }

    public void setNotificationSentAt(Instant notificationSentAt) {
        this.notificationSentAt = notificationSentAt;
    }
}
