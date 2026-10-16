package com.lifeorganizer.birthdays;

import java.time.LocalDate;
import java.time.MonthDay;

public final class BirthdayDates {
    private BirthdayDates() {}
    /** MonthDay uses February 28 for February 29 in non-leap years. */
    public static LocalDate nextOccurrence(int month, int day, LocalDate today) {
        MonthDay birthday = MonthDay.of(month, day);
        LocalDate next = birthday.atYear(today.getYear());
        return next.isBefore(today) ? birthday.atYear(today.getYear() + 1) : next;
    }
}
