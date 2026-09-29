package com.lifeorganizer.gym;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.UUID;

/**
 * Business logic for the gym coach module.
 *
 * Three layers, kept deliberately separate: a reusable exercise library, the
 * programmes that prescribe those exercises at a given volume, and the
 * progress (per-exercise ticks + whole-session logs) recorded against them.
 */
@Service
public class GymService {

    private final LibraryExerciseRepository exerciseRepository;
    private final ProgrammeRepository programmeRepository;
    private final ProgrammeDayRepository dayRepository;
    private final DayExerciseRepository dayExerciseRepository;
    private final ExerciseTickRepository tickRepository;
    private final WorkoutLogRepository workoutLogRepository;

    public GymService(LibraryExerciseRepository exerciseRepository,
                      ProgrammeRepository programmeRepository,
                      ProgrammeDayRepository dayRepository,
                      DayExerciseRepository dayExerciseRepository,
                      ExerciseTickRepository tickRepository,
                      WorkoutLogRepository workoutLogRepository) {
        this.exerciseRepository = exerciseRepository;
        this.programmeRepository = programmeRepository;
        this.dayRepository = dayRepository;
        this.dayExerciseRepository = dayExerciseRepository;
        this.tickRepository = tickRepository;
        this.workoutLogRepository = workoutLogRepository;
    }

    // ---------------------------------------------------------------- library

    @Transactional(readOnly = true)
    public List<LibraryExerciseResponse> listExercises() {
        return exerciseRepository.findAllByOrderByNameAsc()
                .stream()
                .map(LibraryExerciseResponse::from)
                .toList();
    }

    @Transactional
    public LibraryExerciseResponse createExercise(LibraryExerciseRequest request) {
        LibraryExercise exercise = new LibraryExercise(
                request.name(),
                blankToNull(request.imageUrl()),
                blankToNull(request.videoUrl()),
                request.instructions(),
                request.muscleGroup());
        return LibraryExerciseResponse.from(exerciseRepository.save(exercise));
    }

    @Transactional
    public LibraryExerciseResponse updateExercise(UUID id, LibraryExerciseRequest request) {
        LibraryExercise exercise = exerciseRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Exercise not found"));
        exercise.setName(request.name());
        exercise.setImageUrl(blankToNull(request.imageUrl()));
        exercise.setVideoUrl(blankToNull(request.videoUrl()));
        exercise.setInstructions(request.instructions());
        exercise.setMuscleGroup(request.muscleGroup());
        return LibraryExerciseResponse.from(exercise);
    }

    /**
     * Refuses while the exercise is still prescribed somewhere — deleting it
     * would silently tear rows out of days that reference it.
     */
    @Transactional
    public void deleteExercise(UUID id) {
        if (!exerciseRepository.existsById(id)) {
            throw new NoSuchElementException("Exercise not found");
        }
        if (dayExerciseRepository.existsByExerciseId(id)) {
            throw new IllegalStateException("This exercise is used in a programme. Remove it from the programme first.");
        }
        exerciseRepository.deleteById(id);
    }

    // ------------------------------------------------------------- programmes

    @Transactional(readOnly = true)
    public List<ProgrammeResponse> listProgrammes() {
        return programmeRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(ProgrammeResponse::from)
                .toList();
    }

    /** The one the recipient sees. Empty until the owner creates something. */
    @Transactional(readOnly = true)
    public Optional<ProgrammeResponse> getActiveProgramme() {
        return programmeRepository.findFirstByActiveTrue().map(ProgrammeResponse::from);
    }

    @Transactional(readOnly = true)
    public ProgrammeResponse getProgramme(UUID id) {
        return ProgrammeResponse.from(findProgramme(id));
    }

    /** The first programme ever created becomes active, so the app is never empty for her. */
    @Transactional
    public ProgrammeResponse createProgramme(ProgrammeRequest request) {
        boolean makeActive = Boolean.TRUE.equals(request.active())
                || programmeRepository.findFirstByActiveTrue().isEmpty();
        if (makeActive) {
            deactivateAll();
        }
        Programme programme = new Programme(request.name(), blankToNull(request.description()), makeActive);
        return ProgrammeResponse.from(programmeRepository.save(programme));
    }

    @Transactional
    public ProgrammeResponse updateProgramme(UUID id, ProgrammeRequest request) {
        Programme programme = findProgramme(id);
        programme.setName(request.name());
        programme.setDescription(blankToNull(request.description()));
        if (Boolean.TRUE.equals(request.active()) && !programme.isActive()) {
            deactivateAll();
            programme.setActive(true);
        }
        return ProgrammeResponse.from(programme);
    }

    @Transactional
    public void deleteProgramme(UUID id) {
        Programme programme = findProgramme(id);
        boolean wasActive = programme.isActive();
        programmeRepository.delete(programme);
        programmeRepository.flush(); // else the delete isn't visible to the query below

        // Never leave her with no plan: promote the most recent survivor.
        if (wasActive) {
            programmeRepository.findAllByOrderByCreatedAtDesc().stream()
                    .findFirst()
                    .ifPresent(next -> next.setActive(true));
        }
    }

    // ------------------------------------------------------------------- days

    @Transactional
    public ProgrammeDayResponse addDay(UUID programmeId, ProgrammeDayRequest request) {
        Programme programme = findProgramme(programmeId);
        ProgrammeDay day = new ProgrammeDay(request.label(), blankToNull(request.coachNote()));
        programme.addDay(day);
        programmeRepository.save(programme);
        return ProgrammeDayResponse.from(day);
    }

    @Transactional
    public ProgrammeDayResponse updateDay(UUID dayId, ProgrammeDayRequest request) {
        ProgrammeDay day = findDay(dayId);
        day.setLabel(request.label());
        day.setCoachNote(blankToNull(request.coachNote()));
        return ProgrammeDayResponse.from(day);
    }

    /** Removing from the parent collection is enough — orphanRemoval does the delete. */
    @Transactional
    public void deleteDay(UUID dayId) {
        ProgrammeDay day = findDay(dayId);
        day.getProgramme().getDays().remove(day);
    }

    /** Replaces the day's whole list — see {@link DayExercisesRequest} for why. */
    @Transactional
    public ProgrammeDayResponse setDayExercises(UUID dayId, DayExercisesRequest request) {
        ProgrammeDay day = findDay(dayId);
        day.clearExercises();

        for (DayExercisesRequest.Entry entry : request.exercises()) {
            LibraryExercise exercise = exerciseRepository.findById(entry.exerciseId())
                    .orElseThrow(() -> new NoSuchElementException("Exercise not found: " + entry.exerciseId()));
            day.addExercise(new DayExercise(
                    exercise,
                    entry.sets(),
                    entry.reps(),
                    entry.restSeconds(),
                    blankToNull(entry.note())));
        }

        dayRepository.save(day);
        return ProgrammeDayResponse.from(day);
    }

    // --------------------------------------------------------------- progress

    /**
     * Ticks or unticks one exercise for one day. Idempotent in both directions,
     * so a double-tap or a retry can't create duplicates or fail.
     */
    @Transactional
    public Optional<ExerciseTickResponse> setTick(TickRequest request, UUID userId) {
        if (!dayExerciseRepository.existsById(request.dayExerciseId())) {
            throw new NoSuchElementException("Exercise not found in this day");
        }

        Optional<ExerciseTick> existing = tickRepository
                .findByDayExerciseIdAndUserIdAndTickDate(request.dayExerciseId(), userId, request.tickDate());

        if (!request.done()) {
            existing.ifPresent(tickRepository::delete);
            return Optional.empty();
        }

        ExerciseTick tick = existing.orElseGet(() -> tickRepository.save(
                new ExerciseTick(request.dayExerciseId(), userId, request.tickDate())));
        return Optional.of(ExerciseTickResponse.from(tick));
    }

    /** Ticks from {@code from} onwards — both people's, so each can see the other's progress. */
    @Transactional(readOnly = true)
    public List<ExerciseTickResponse> getTicks(LocalDate from) {
        return tickRepository.findAllByTickDateGreaterThanEqual(from)
                .stream()
                .map(ExerciseTickResponse::from)
                .toList();
    }

    @Transactional
    public WorkoutLogResponse logCompletion(UUID programmeDayId, UUID userId) {
        if (!dayRepository.existsById(programmeDayId)) {
            throw new NoSuchElementException("Workout day not found");
        }
        WorkoutLog log = new WorkoutLog(programmeDayId, userId, Instant.now());
        workoutLogRepository.save(log);
        return WorkoutLogResponse.from(log);
    }

    @Transactional(readOnly = true)
    public List<WorkoutLogResponse> getLogs() {
        return workoutLogRepository.findAllByOrderByCompletedAtDesc()
                .stream()
                .map(WorkoutLogResponse::from)
                .toList();
    }

    // ---------------------------------------------------------------- helpers

    private Programme findProgramme(UUID id) {
        return programmeRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Programme not found"));
    }

    private ProgrammeDay findDay(UUID id) {
        return dayRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Workout day not found"));
    }

    private void deactivateAll() {
        programmeRepository.findAll().forEach(p -> p.setActive(false));
    }

    /** Empty strings from the form arrive as "", which we'd rather store as null. */
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
