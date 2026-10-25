package com.lifeorganizer.watchlist;

import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface WatchReviewRepository extends JpaRepository<WatchReview, UUID> {
    @EntityGraph(attributePaths = "user")
    List<WatchReview> findByItemIdAndCoupleIdOrderByUpdatedAtAsc(UUID itemId, UUID coupleId);
    Optional<WatchReview> findByItemIdAndUserIdAndCoupleId(UUID itemId, UUID userId, UUID coupleId);
    void deleteByItemIdAndCoupleId(UUID itemId, UUID coupleId);
}
