package com.lifeorganizer.watchlist;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface WatchRepository extends JpaRepository<WatchItem, UUID> {
    List<WatchItem> findAllByOrderByCreatedAtDescIdDesc();
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select w from WatchItem w where w.id = :id")
    Optional<WatchItem> lockById(UUID id);
}
