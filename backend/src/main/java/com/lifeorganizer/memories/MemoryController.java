package com.lifeorganizer.memories;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Memory timeline API. The OWNER uploads memories; both roles can read the feed.
 */
@RestController
@RequestMapping("/api/memories")
public class MemoryController {

    private final MemoryService memoryService;

    public MemoryController(MemoryService memoryService) {
        this.memoryService = memoryService;
    }

    @PostMapping
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<MemoryResponse> create(@Valid @RequestBody MemoryRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(memoryService.create(request));
    }

    @GetMapping
    public List<MemoryResponse> list() {
        return memoryService.list();
    }
}
