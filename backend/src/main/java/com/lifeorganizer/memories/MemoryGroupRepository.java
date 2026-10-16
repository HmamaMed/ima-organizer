package com.lifeorganizer.memories;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.time.Instant;
import java.util.*;

public interface MemoryGroupRepository extends JpaRepository<MemoryGroup, UUID> {
    @Query("select g from MemoryGroup g where g.deletedAt is null and g.expiresAt > :now order by g.createdAt")
    List<MemoryGroup> findVisible(Instant now);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from MemoryGroup g where g.id = :id")
    Optional<MemoryGroup> lockById(UUID id);
    @Query("select g.id from MemoryGroup g where g.deletedAt is not null or g.expiresAt <= :now")
    List<UUID> findDueIds(Instant now);
    List<MemoryGroup> findByExpiresAtIsNull();
    @Query("select g.id from MemoryGroup g") List<UUID> findGroupIds();
}
