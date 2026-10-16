package com.lifeorganizer.memories;

import org.springframework.data.jpa.repository.*;
import java.time.Instant;
import java.util.*;

public interface MemoryRepository extends JpaRepository<Memory, UUID> {
    @Query("select m from Memory m join m.group g where g.deletedAt is null and g.expiresAt > :now order by m.memoryDate desc")
    List<Memory> findVisible(Instant now);
    List<Memory> findByGroupId(UUID groupId);
    List<Memory> findByGroupIsNull();
    void deleteByGroupId(UUID groupId);
}
