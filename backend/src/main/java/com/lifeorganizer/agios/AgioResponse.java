package com.lifeorganizer.agios;

import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AgioResponse(UUID id, UUID userId, String amount, LocalDate date, Instant createdAt) {
    public static AgioResponse from(Agio agio) {
        return new AgioResponse(agio.getId(), agio.getUser().getId(),
                agio.getAmount().setScale(2, RoundingMode.UNNECESSARY).toPlainString(),
                agio.getDate(), agio.getCreatedAt());
    }
}
