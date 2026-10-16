package com.lifeorganizer.birthdays;

import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

/** A successful FCM acceptance, retained across scheduler runs and reminder edits. */
@Entity
@Table(name = "birthday_deliveries", uniqueConstraints = @UniqueConstraint(
        name = "birthday_delivery_unique", columnNames = {"reminder_id", "birthday_date", "days_before"}))
public class BirthdayDelivery {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reminder_id", nullable = false) private BirthdayReminder reminder;
    @Column(name = "birthday_date", nullable = false) private LocalDate birthdayDate;
    @Column(name = "days_before", nullable = false) private int daysBefore;
    @Column(nullable = false) private Instant sentAt;
    protected BirthdayDelivery() {}
    public BirthdayDelivery(BirthdayReminder reminder, LocalDate birthdayDate, int daysBefore, Instant sentAt) {
        this.reminder = reminder; this.birthdayDate = birthdayDate; this.daysBefore = daysBefore; this.sentAt = sentAt;
    }
}
