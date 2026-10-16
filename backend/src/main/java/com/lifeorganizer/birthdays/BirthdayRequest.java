package com.lifeorganizer.birthdays;

import jakarta.validation.constraints.*;
import java.time.DateTimeException;
import java.time.MonthDay;
import java.time.ZoneId;

public record BirthdayRequest(
        @NotBlank @Size(max = 100) String label,
        @NotNull @Min(1) @Max(12) Integer month,
        @NotNull @Min(1) @Max(31) Integer day,
        @NotBlank @Size(max = 100) String timeZone
) {
    @AssertTrue(message = "must be a real birthday date")
    public boolean isValidDate() {
        if (month == null || day == null) return true;
        try { MonthDay.of(month, day); return true; }
        catch (DateTimeException e) { return false; }
    }
    @AssertTrue(message = "must be a supported time zone")
    public boolean isValidTimeZone() {
        if (timeZone == null || timeZone.isBlank()) return true;
        try { ZoneId.of(timeZone); return true; }
        catch (DateTimeException e) { return false; }
    }
}
