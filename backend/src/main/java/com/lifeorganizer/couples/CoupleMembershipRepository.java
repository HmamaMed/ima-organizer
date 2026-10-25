package com.lifeorganizer.couples;

import org.springframework.data.jpa.repository.*;
import java.util.Optional;
import java.util.UUID;

public interface CoupleMembershipRepository extends JpaRepository<CoupleMembership, UUID> {
    @EntityGraph(attributePaths = "couple")
    Optional<CoupleMembership> findByUserIdAndLeftAtIsNull(UUID userId);
    boolean existsByUserIdAndCoupleIdAndLeftAtIsNull(UUID userId, UUID coupleId);
}
