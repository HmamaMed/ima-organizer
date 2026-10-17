package com.lifeorganizer.watchlist;

import jakarta.validation.constraints.*;

public record WatchRequest(@NotBlank @Size(max = 150) String title,
                           @NotNull WatchItem.Kind kind,
                           @NotNull WatchItem.Status status,
                           @Size(max = 2000) String notes) {
    public record StatusRequest(@NotNull WatchItem.Status status) {}
    public record ReviewRequest(@NotNull @Min(1) @Max(5) Integer rating, @Size(max = 2000) String comment) {}
}
