package com.lifeorganizer.memories;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface MemoryRepository extends JpaRepository<Memory, UUID> {

    /** Timeline ordered by memory date, newest first. */
    List<Memory> findAllByOrderByMemoryDateDesc();
}
