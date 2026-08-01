package com.lifeorganizer.auth;

import jakarta.validation.constraints.NotBlank;

/**
 * Login payload. fcmToken is optional — the recipient's device registers its
 * push token here on login so the backend can reach it later.
 */
public record LoginRequest(
        @NotBlank String username,
        @NotBlank String password,
        String fcmToken) {
}
