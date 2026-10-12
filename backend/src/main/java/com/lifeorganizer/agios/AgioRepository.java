package com.lifeorganizer.agios;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AgioRepository extends JpaRepository<Agio, UUID> {
    @EntityGraph(attributePaths = "user")
    List<Agio> findAllByOrderByDateDescCreatedAtDesc();
}
