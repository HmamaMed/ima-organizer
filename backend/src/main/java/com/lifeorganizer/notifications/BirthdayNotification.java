package com.lifeorganizer.notifications;

import com.lifeorganizer.auth.User;
import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

/** Snapshot retained independently of birthday edits, deletion, and push delivery. */
@Entity
@Table(name = "birthday_notifications", uniqueConstraints = @UniqueConstraint(
        name = "birthday_notification_unique", columnNames = {"reminder_id", "birthday_date", "days_before"}),
        indexes = @Index(name = "birthday_notification_inbox", columnList = "user_id,dismissed,created_at"))
public class BirthdayNotification {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false) private User user;
    // No reminder FK: removing a birthday must not erase an already received message.
    @Column(name = "reminder_id", nullable = false) private UUID reminderId;
    @Column(name = "birthday_date", nullable = false) private LocalDate birthdayDate;
    @Column(name = "days_before", nullable = false) private int daysBefore;
    @Column(nullable = false, length = 80) private String title;
    @Column(nullable = false, length = 200) private String body;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(nullable = false) private boolean dismissed;

    protected BirthdayNotification() {}
    public BirthdayNotification(User user, UUID reminderId, LocalDate birthdayDate, int daysBefore,
                                String title, String body, Instant createdAt) {
        this.user = user; this.reminderId = reminderId; this.birthdayDate = birthdayDate;
        this.daysBefore = daysBefore; this.title = title; this.body = body; this.createdAt = createdAt;
    }
    public UUID getId() { return id; }
    public String getTitle() { return title; }
    public String getBody() { return body; }
    public Instant getCreatedAt() { return createdAt; }
}
