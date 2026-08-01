package com.lifeorganizer.auth;

import java.util.UUID;

public record LoginResponse(
        String token,
        UUID userId,
        Role role,
        String name) {
}
