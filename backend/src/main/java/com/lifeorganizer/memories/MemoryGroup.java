package com.lifeorganizer.memories;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.Duration;
import java.util.UUID;

/** A shared category that expires 72 hours after creation, even if it remains empty. */
@Entity
@Table(name = "memory_groups")
public class MemoryGroup {
    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private Instant createdAt;

    // Null identifies a category created before the temporary-memories rollout.
    @Column private Instant expiresAt;
    @Column private Instant deletedAt;

    protected MemoryGroup() {}

    public MemoryGroup(String name, String description) {
        this.name = name;
        this.description = description;
        this.createdAt = Instant.now();
        this.expiresAt = createdAt.plus(Duration.ofDays(3));
    }

    public static MemoryGroup legacyCleanup() {
        MemoryGroup group = new MemoryGroup("Previous memories cleanup", null);
        group.expiresAt = null;
        group.requestDeletion(Instant.now());
        return group;
    }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getDeletedAt() { return deletedAt; }
    public boolean isVisible(Instant now) { return deletedAt == null && expiresAt != null && expiresAt.isAfter(now); }
    public void requestDeletion(Instant now) { deletedAt = now; }
    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Instant getCreatedAt() { return createdAt; }
}
