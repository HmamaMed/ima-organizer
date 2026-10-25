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
    @GetMapping public List<WatchResponse> list(@AuthenticationPrincipal User user,@RequestParam(defaultValue="0")int page,@RequestParam(defaultValue="50")int size,@RequestParam(defaultValue="")String q,@RequestParam(required=false)WatchItem.Kind kind,@RequestParam(required=false)WatchItem.Status status) { return service.list(user,page,size,q,kind,status); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    public WatchResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody WatchRequest request) { return service.create(user, request); }
    @PutMapping("/{id}") public WatchResponse update(@PathVariable UUID id, @AuthenticationPrincipal User user, @Valid @RequestBody WatchRequest request) { return service.update(id, user, request); }
    @PatchMapping("/{id}/status") public WatchResponse status(@PathVariable UUID id, @AuthenticationPrincipal User user, @Valid @RequestBody WatchRequest.StatusRequest request) { return service.status(id, user, request.status()); }
    @PutMapping("/{id}/review") public WatchResponse review(@PathVariable UUID id, @AuthenticationPrincipal User user, @Valid @RequestBody WatchRequest.ReviewRequest request) { return service.review(id, user, request); }
    @DeleteMapping("/{id}/review") public WatchResponse deleteReview(@PathVariable UUID id, @AuthenticationPrincipal User user) { return service.deleteReview(id, user); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@PathVariable UUID id, @AuthenticationPrincipal User user) { service.delete(id, user); }
}
