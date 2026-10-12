package com.lifeorganizer.agios;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Both authenticated participants can read and maintain their shared tracker. */
@RestController
@RequestMapping("/api/agios")
public class AgiosController {
    private final AgiosService service;

    public AgiosController(AgiosService service) { this.service = service; }

    @GetMapping
    public AgiosTrackerResponse tracker() { return service.tracker(); }

    @PostMapping
    public ResponseEntity<AgioResponse> create(@Valid @RequestBody AgioRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    public AgioResponse update(@PathVariable UUID id, @Valid @RequestBody AgioRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
