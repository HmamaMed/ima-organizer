package com.lifeorganizer.watchlist;

import java.time.Instant;
import java.util.*;

public record WatchResponse(UUID id, String title, WatchItem.Kind kind, WatchItem.Status status, String notes,
                            Instant createdAt, List<ReviewResponse> reviews) {
    public record ReviewResponse(UUID userId, String name, int rating, String comment, Instant updatedAt) {}
}
