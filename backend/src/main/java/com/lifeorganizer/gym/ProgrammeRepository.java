package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProgrammeRepository extends JpaRepository<Programme, UUID> {

    Optional<Programme> findFirstByActiveTrue();

    List<Programme> findAllByOrderByCreatedAtDesc();
}
