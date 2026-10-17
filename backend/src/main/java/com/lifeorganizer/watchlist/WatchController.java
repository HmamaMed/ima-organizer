package com.lifeorganizer.watchlist;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;


@RestController
@RequestMapping("/api/watchlist")
public class WatchController {
    private final WatchService service;
    public WatchController(WatchService service) { this.service = service; }
    @GetMapping public List<WatchResponse> list() { return service.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public WatchResponse create(@Valid @RequestBody WatchRequest request) { return service.create(request); }
    @PutMapping("/{id}") public WatchResponse update(@PathVariable UUID id, @Valid @RequestBody WatchRequest request) { return service.update(id, request); }
    @PatchMapping("/{id}/status") public WatchResponse status(@PathVariable UUID id, @Valid @RequestBody WatchRequest.StatusRequest request) { return service.status(id, request.status()); }
    @PutMapping("/{id}/review") public WatchResponse review(@PathVariable UUID id, @AuthenticationPrincipal User user, @Valid @RequestBody WatchRequest.ReviewRequest request) { return service.review(id, user, request); }
    @DeleteMapping("/{id}/review") public WatchResponse deleteReview(@PathVariable UUID id, @AuthenticationPrincipal User user) { return service.deleteReview(id, user); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id) { service.delete(id); }
}
