package com.lifeorganizer.seed;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Credentials for the two seeded users. Overridable via environment variables
 * in production (e.g. SEED_OWNER_USERNAME, SEED_OWNER_PASSWORD).
 */
@ConfigurationProperties(prefix = "app.seed")
public record SeedProperties(
        String ownerUsername,
        String ownerPassword,
        String recipientUsername,
        String recipientPassword) {
}
