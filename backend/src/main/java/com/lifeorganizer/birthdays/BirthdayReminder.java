package com.lifeorganizer.birthdays;

import com.lifeorganizer.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "birthday_reminders", indexes = @Index(name = "birthdays_user_idx", columnList = "user_id"))
public class BirthdayReminder {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false) private User user;
    @Column(nullable = false, length = 100) private String label;
    @Column(name = "birthday_month", nullable = false) private int month;
    @Column(name = "birthday_day", nullable = false) private int day;
    @Column(nullable = false, length = 100) private String timeZone;
    @Column(nullable = false, updatable = false) private Instant createdAt;

    protected BirthdayReminder() {}
    public BirthdayReminder(User user, BirthdayRequest request) {
        this.user = user;
        this.createdAt = Instant.now();
        update(request);
    }
    public void update(BirthdayRequest request) {
        label = request.label().strip(); month = request.month(); day = request.day(); timeZone = request.timeZone();
    }
    public UUID getId() { return id; }
    public User getUser() { return user; }
    public String getLabel() { return label; }
    public int getMonth() { return month; }
    public int getDay() { return day; }
    public String getTimeZone() { return timeZone; }
}
