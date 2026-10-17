package com.lifeorganizer.watchlist;

import com.lifeorganizer.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "watch_reviews", uniqueConstraints = @UniqueConstraint(name = "watch_review_per_user", columnNames = {"item_id", "user_id"}))
public class WatchReview {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "item_id", nullable = false) private WatchItem item;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "user_id", nullable = false) private User user;
    @Column(nullable = false) private int rating;
    @Column(length = 2000) private String comment;
    @Column(nullable = false) private Instant updatedAt;
    protected WatchReview() {}
    public WatchReview(WatchItem item, User user) { this.item = item; this.user = user; }
    public void update(WatchRequest.ReviewRequest request) {
        rating = request.rating(); comment = request.comment() == null || request.comment().isBlank() ? null : request.comment().trim(); updatedAt = Instant.now();
    }
    public User getUser() { return user; }
    public int getRating() { return rating; }
    public String getComment() { return comment; }
    public Instant getUpdatedAt() { return updatedAt; }
}
