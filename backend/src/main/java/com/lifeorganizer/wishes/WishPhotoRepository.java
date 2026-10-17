package com.lifeorganizer.wishes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.time.Instant;
import java.util.*;

public interface WishPhotoRepository extends JpaRepository<WishPhoto, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from WishPhoto p where p.id = :id")
    Optional<WishPhoto> lockById(UUID id);
    @Query("select p.id from WishPhoto p where p.deleteAfter <= :now")
    List<UUID> findDueIds(Instant now);
}
