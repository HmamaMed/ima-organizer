package com.lifeorganizer.birthdays;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/birthdays")
public class BirthdayController {
    private final BirthdayService service;
    public BirthdayController(BirthdayService service) { this.service = service; }
    @GetMapping
    public List<BirthdayResponse> list(@AuthenticationPrincipal User user) { return service.list(user); }
    @PostMapping
    public ResponseEntity<BirthdayResponse> create(@AuthenticationPrincipal User user, @Valid @RequestBody BirthdayRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(user, request));
    }
    @PutMapping("/{id}")
    public BirthdayResponse update(@AuthenticationPrincipal User user, @PathVariable UUID id, @Valid @RequestBody BirthdayRequest request) {
        return service.update(user, id, request);
    }
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal User user, @PathVariable UUID id) {
        service.delete(user, id);
        return ResponseEntity.noContent().build();
    }
}
