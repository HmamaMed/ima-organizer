package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProgrammeDayRepository extends JpaRepository<ProgrammeDay, UUID> {
}
