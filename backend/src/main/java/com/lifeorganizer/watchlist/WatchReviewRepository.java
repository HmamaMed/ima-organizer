package com.lifeorganizer.watchlist;

import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface WatchReviewRepository extends JpaRepository<WatchReview, UUID> {
    @EntityGraph(attributePaths = "user")
    List<WatchReview> findByItemIdOrderByUpdatedAtAsc(UUID itemId);
    Optional<WatchReview> findByItemIdAndUserId(UUID itemId, UUID userId);
    void deleteByItemId(UUID itemId);
}
