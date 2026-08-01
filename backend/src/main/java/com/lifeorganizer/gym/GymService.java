package com.lifeorganizer.gym;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;

/**
 * Business logic for the gym coach module — pure content + a completion
 * checklist. No push dependency, no media handling.
 */
@Service
public class GymService {

    private final WorkoutDayRepository workoutDayRepository;
    private final WorkoutLogRepository workoutLogRepository;

    public GymService(WorkoutDayRepository workoutDayRepository,
                      WorkoutLogRepository workoutLogRepository) {
        this.workoutDayRepository = workoutDayRepository;
        this.workoutLogRepository = workoutLogRepository;
    }

    /** Full plan — all days with their exercises. */
    @Transactional(readOnly = true)
    public List<WorkoutDayResponse> getPlan() {
        return workoutDayRepository.findAllByOrderByIdAsc()
                .stream()
                .map(WorkoutDayResponse::from)
                .toList();
    }

    /** Mark a workout day complete. */
    @Transactional
    public WorkoutLogResponse logCompletion(UUID workoutDayId) {
        if (!workoutDayRepository.existsById(workoutDayId)) {
            throw new NoSuchElementException("Workout day not found");
        }
        WorkoutLog log = new WorkoutLog(workoutDayId, Instant.now());
        workoutLogRepository.save(log);
        return WorkoutLogResponse.from(log);
    }

    /** Completion history, newest first. */
    @Transactional(readOnly = true)
    public List<WorkoutLogResponse> getLogs() {
        return workoutLogRepository.findAllByOrderByCompletedAtDesc()
                .stream()
                .map(WorkoutLogResponse::from)
                .toList();
    }
}
