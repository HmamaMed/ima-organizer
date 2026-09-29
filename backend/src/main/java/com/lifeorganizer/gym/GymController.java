package com.lifeorganizer.gym;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Gym coach API.
 *
 * Authoring (library + programmes) is OWNER-only; reading the plan and
 * recording progress is open to both roles, so the owner can train alongside
 * her and each can see the other's ticks.
 */
@RestController
@RequestMapping("/api/gym")
public class GymController {

    private final GymService gymService;

    public GymController(GymService gymService) {
        this.gymService = gymService;
    }

    // ---------------------------------------------------------------- library

    @GetMapping("/exercises")
    public List<LibraryExerciseResponse> listExercises() {
        return gymService.listExercises();
    }

    @PostMapping("/exercises")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<LibraryExerciseResponse> createExercise(@Valid @RequestBody LibraryExerciseRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gymService.createExercise(request));
    }

    @PutMapping("/exercises/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public LibraryExerciseResponse updateExercise(@PathVariable UUID id,
                                                  @Valid @RequestBody LibraryExerciseRequest request) {
        return gymService.updateExercise(id, request);
    }

    @DeleteMapping("/exercises/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteExercise(@PathVariable UUID id) {
        gymService.deleteExercise(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------- programmes

    /** What the recipient sees — 204 while the owner hasn't built anything yet. */
    @GetMapping("/programmes/active")
    public ResponseEntity<ProgrammeResponse> getActiveProgramme() {
        return gymService.getActiveProgramme()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/programmes")
    @PreAuthorize("hasRole('OWNER')")
    public List<ProgrammeResponse> listProgrammes() {
        return gymService.listProgrammes();
    }

    @GetMapping("/programmes/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ProgrammeResponse getProgramme(@PathVariable UUID id) {
        return gymService.getProgramme(id);
    }

    @PostMapping("/programmes")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ProgrammeResponse> createProgramme(@Valid @RequestBody ProgrammeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gymService.createProgramme(request));
    }

    @PutMapping("/programmes/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ProgrammeResponse updateProgramme(@PathVariable UUID id, @Valid @RequestBody ProgrammeRequest request) {
        return gymService.updateProgramme(id, request);
    }

    @DeleteMapping("/programmes/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteProgramme(@PathVariable UUID id) {
        gymService.deleteProgramme(id);
        return ResponseEntity.noContent().build();
    }

    // ------------------------------------------------------------------- days

    @PostMapping("/programmes/{id}/days")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<ProgrammeDayResponse> addDay(@PathVariable UUID id,
                                                       @Valid @RequestBody ProgrammeDayRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(gymService.addDay(id, request));
    }

    @PutMapping("/days/{dayId}")
    @PreAuthorize("hasRole('OWNER')")
    public ProgrammeDayResponse updateDay(@PathVariable UUID dayId, @Valid @RequestBody ProgrammeDayRequest request) {
        return gymService.updateDay(dayId, request);
    }

    @DeleteMapping("/days/{dayId}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteDay(@PathVariable UUID dayId) {
        gymService.deleteDay(dayId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/days/{dayId}/exercises")
    @PreAuthorize("hasRole('OWNER')")
    public ProgrammeDayResponse setDayExercises(@PathVariable UUID dayId,
                                                @Valid @RequestBody DayExercisesRequest request) {
        return gymService.setDayExercises(dayId, request);
    }

    // --------------------------------------------------------------- progress

    /** Returns the tick on a check, or 204 on an uncheck (there's nothing left to return). */
    @PostMapping("/ticks")
    public ResponseEntity<ExerciseTickResponse> setTick(@Valid @RequestBody TickRequest request,
                                                        @AuthenticationPrincipal User user) {
        return gymService.setTick(request, user.getId())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/ticks")
    public List<ExerciseTickResponse> getTicks(@RequestParam(defaultValue = "60") int days) {
        return gymService.getTicks(LocalDate.now().minusDays(days));
    }

    @PostMapping("/log")
    public ResponseEntity<WorkoutLogResponse> logCompletion(@Valid @RequestBody WorkoutLogRequest request,
                                                            @AuthenticationPrincipal User user) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(gymService.logCompletion(request.programmeDayId(), user.getId()));
    }

    @GetMapping("/log")
    public List<WorkoutLogResponse> getLogs() {
        return gymService.getLogs();
    }
}
