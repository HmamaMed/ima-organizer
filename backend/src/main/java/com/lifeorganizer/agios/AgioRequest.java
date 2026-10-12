package com.lifeorganizer.agios;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AgioRequest(
        @NotNull UUID userId,
        @NotNull @DecimalMin("0.01") @Digits(integer = 12, fraction = 2) BigDecimal amount,
        @NotNull @PastOrPresent LocalDate date
) {}
