package com.lifeorganizer.memories;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface MemoryGroupRepository extends JpaRepository<MemoryGroup, UUID> {
    List<MemoryGroup> findAllByOrderByCreatedAtAsc();
}
