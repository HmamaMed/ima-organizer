package com.lifeorganizer.wishes;

import java.time.Instant;
import java.util.UUID;

public record WishResponse(UUID id, String title, WishCategory category, String details, String link,
                           UUID photoId, String photoUrl, Instant createdAt) {}
