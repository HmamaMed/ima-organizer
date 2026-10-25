package com.lifeorganizer.couples;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.Optional;
import java.util.UUID;

public interface CoupleRepository extends JpaRepository<Couple, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Couple c where c.id = :id")
    Optional<Couple> lockById(UUID id);
}
