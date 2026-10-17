package com.lifeorganizer.wishes;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "wishes")
public class Wish {
    @Id @GeneratedValue private UUID id;
    @Column(nullable = false, length = 150) private String title;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) private WishCategory category;
    @Column(length = 2000) private String details;
    @Column(length = 2000) private String link;
    @OneToOne(fetch = FetchType.LAZY) @JoinColumn(name = "photo_id", unique = true) private WishPhoto photo;
    @Column(nullable = false) private Instant createdAt;
    protected Wish() {}
    public Wish(Instant createdAt) { this.createdAt = createdAt; }
    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public WishCategory getCategory() { return category; }
    public String getDetails() { return details; }
    public String getLink() { return link; }
    public WishPhoto getPhoto() { return photo; }
    public Instant getCreatedAt() { return createdAt; }
    public void update(WishRequest request, WishPhoto photo) {
        this.title = request.title().trim(); this.category = request.category();
        this.details = clean(request.details()); this.link = clean(request.link()); this.photo = photo;
    }
    private static String clean(String value) { return value == null || value.isBlank() ? null : value.trim(); }
}
