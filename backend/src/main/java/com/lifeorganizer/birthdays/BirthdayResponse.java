package com.lifeorganizer.birthdays;

import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

public record BirthdayResponse(UUID id, String label, int month, int day, String timeZone,
                               LocalDate nextBirthday, long daysUntil) {
    public static BirthdayResponse from(BirthdayReminder reminder, Instant now) { return from(reminder, now, false); }
    public static BirthdayResponse from(BirthdayReminder reminder, Instant now, boolean standardZone) {
        LocalDate today = now.atZone(standardZone ? ZoneId.of(reminder.getTimeZone()) : MoroccoTime.zone(reminder.getTimeZone(), now)).toLocalDate();
        LocalDate next = BirthdayDates.nextOccurrence(reminder.getMonth(), reminder.getDay(), today);
        return new BirthdayResponse(reminder.getId(), reminder.getLabel(), reminder.getMonth(), reminder.getDay(),
                reminder.getTimeZone(), next, ChronoUnit.DAYS.between(today, next));
    }
}
