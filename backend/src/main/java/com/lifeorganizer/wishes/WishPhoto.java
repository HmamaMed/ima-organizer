package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.User;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

/** Durable upload ledger: reserve before writing R2, keep until deletion succeeds. */
@Entity
@Table(name = "wish_photos", indexes = @Index(name = "wish_photos_cleanup", columnList = "delete_after"))
public class WishPhoto {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "uploader_id", nullable = false) private User uploader;
    @Column(nullable = false, unique = true, length = 200) private String objectKey;
    @Column(nullable = false) private boolean ready;
    // Null means attached. Unused uploads expire after 24h; removed photos are due immediately.
    @Column(name = "delete_after") private Instant deleteAfter;
    protected WishPhoto() {}
    public WishPhoto(User uploader, String key, Instant now) {
        this.uploader = uploader; this.objectKey = key; this.deleteAfter = now.plus(Duration.ofHours(24));
    }
    public UUID getId() { return id; }
    public String getObjectKey() { return objectKey; }
    public void markReady() { ready = true; }
    public void attach(User user, Instant now) {
        if (!uploader.getId().equals(user.getId()) || !ready || deleteAfter == null || !deleteAfter.isAfter(now))
            throw new IllegalArgumentException("Cette photo n’est plus disponible. Ajoutez-la à nouveau.");
        deleteAfter = null;
    }
    public void queueDeletion(Instant now) { deleteAfter = now; }
    public boolean isDue(Instant now) { return deleteAfter != null && !deleteAfter.isAfter(now); }
}
