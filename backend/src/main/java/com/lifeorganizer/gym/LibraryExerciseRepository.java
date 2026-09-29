package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LibraryExerciseRepository extends JpaRepository<LibraryExercise, UUID> {

    List<LibraryExercise> findAllByOrderByNameAsc();
}
