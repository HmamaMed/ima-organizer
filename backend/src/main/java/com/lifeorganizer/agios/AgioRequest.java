package com.lifeorganizer.agios;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AgioRequest(
        @NotNull UUID userId,
        @NotNull @Digits(integer = 12, fraction = 2) BigDecimal amount,
        @NotNull @PastOrPresent LocalDate date
) {
    /** Positive amounts are interest credits; negative amounts are withdrawals. */
    @AssertTrue(message = "must be a non-zero amount")
    public boolean isNonZeroAmount() {
        return amount == null || amount.signum() != 0;
    }
}
