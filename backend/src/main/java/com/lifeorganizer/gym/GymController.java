package com.lifeorganizer.gym;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Gym coach API. The plan is read by both roles; the RECIPIENT marks days
 * complete (the OWNER can too, for convenience).
 */
@RestController
@RequestMapping("/api/gym")
public class GymController {

    private final GymService gymService;

    public GymController(GymService gymService) {
        this.gymService = gymService;
    }

    @GetMapping("/plan")
    public List<WorkoutDayResponse> getPlan() {
        return gymService.getPlan();
    }

    @PostMapping("/log")
    public ResponseEntity<WorkoutLogResponse> logCompletion(@Valid @RequestBody WorkoutLogRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(gymService.logCompletion(request.workoutDayId()));
    }

    @GetMapping("/log")
    public List<WorkoutLogResponse> getLogs() {
        return gymService.getLogs();
    }
}
