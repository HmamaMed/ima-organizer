package com.lifeorganizer.wishes;

import jakarta.validation.constraints.*;
import java.net.URI;
import java.util.UUID;

public record WishRequest(@NotBlank @Size(max = 150) String title,
                          @NotNull WishCategory category,
                          @Size(max = 2000) String details,
                          @Size(max = 2000) String link,
                          UUID photoId) {
    @AssertTrue(message = "Le lien doit être une adresse HTTP ou HTTPS valide.")
    public boolean isLinkValid() {
        if (link == null || link.isBlank()) return true;
        try {
            URI uri = URI.create(link.trim());
            return ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
                    && uri.getHost() != null && uri.getUserInfo() == null;
        } catch (IllegalArgumentException e) { return false; }
    }
}
