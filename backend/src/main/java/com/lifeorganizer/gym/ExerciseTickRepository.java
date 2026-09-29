package com.lifeorganizer.gym;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ExerciseTickRepository extends JpaRepository<ExerciseTick, UUID> {

    List<ExerciseTick> findAllByTickDate(LocalDate tickDate);

    List<ExerciseTick> findAllByTickDateGreaterThanEqual(LocalDate from);

    Optional<ExerciseTick> findByDayExerciseIdAndUserIdAndTickDate(UUID dayExerciseId, UUID userId, LocalDate tickDate);
}
