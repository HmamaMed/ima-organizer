package com.lifeorganizer.watchlist;

import jakarta.persistence.*;
import com.lifeorganizer.auth.User;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "watch_items")
public class WatchItem {
    public enum Kind { FILM, SERIES }
    public enum Status { TO_WATCH, IN_PROGRESS, WATCHED }
    @Id @GeneratedValue private UUID id;
    // Nullable only for the unchanged personal deployment; commercial migrations enforce NOT NULL.
    @Column(updatable = false) private UUID coupleId;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "created_by_id", updatable = false)
    private User createdBy;
    @Column(nullable = false, length = 150) private String title;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Kind kind;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private Status status;
    @Column(length = 2000) private String notes;
    @Column(nullable = false) private Instant createdAt;
    protected WatchItem() {}
    public WatchItem(Instant now, UUID coupleId, User creator) { createdAt = now; this.coupleId = coupleId; createdBy = creator; }
    public void update(WatchRequest request) {
        title = request.title().trim(); kind = request.kind(); status = request.status();
        notes = request.notes() == null || request.notes().isBlank() ? null : request.notes().trim();
    }
    public UUID getCoupleId() { return coupleId; }
    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public Kind getKind() { return kind; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public String getNotes() { return notes; }
    public Instant getCreatedAt() { return createdAt; }
}
