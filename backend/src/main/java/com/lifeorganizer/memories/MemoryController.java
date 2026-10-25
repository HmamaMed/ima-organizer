package com.lifeorganizer.memories;

import org.springframework.context.annotation.Profile;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import com.lifeorganizer.media.MediaUploadService;
import java.util.UUID;
import java.util.Map;

import java.util.List;

/**
 * Memory timeline API. The OWNER uploads memories; both roles can read the feed.
 */
@RestController
@RequestMapping("/api/memories")
@Profile("!couples")
public class MemoryController {

    private final MemoryService memoryService;
    private final MediaUploadService uploads;
    private final MemoryCleanupService cleanup;
    private final MemoryCleanupScheduler scheduler;

    public MemoryController(MemoryService memoryService, MediaUploadService uploads, MemoryCleanupService cleanup, MemoryCleanupScheduler scheduler) {
        this.memoryService = memoryService;
        this.uploads = uploads;
        this.cleanup = cleanup;
        this.scheduler = scheduler;
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

    @PostMapping("/groups")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<MemoryGroupResponse> createGroup(@Valid @RequestBody MemoryGroupRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(memoryService.createGroup(request));
    }

    @GetMapping("/groups")
    public List<MemoryGroupResponse> listGroups() {
        return memoryService.listGroups();
    }

    @PostMapping(value = "/groups/{id}/media", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<MediaUploadService.UploadResponse> upload(@PathVariable UUID id, @RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(uploads.upload(id,file));
    }

    @DeleteMapping("/groups/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<Void> deleteGroup(@PathVariable UUID id) {
        memoryService.deleteGroup(id);
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/cleanup-status")
    @PreAuthorize("hasRole('OWNER')")
    public Map<String, Object> cleanupStatus() { return cleanup.status(); }

    @PostMapping("/cleanup")
    @PreAuthorize("hasRole('OWNER')")
    public Map<String, Object> runCleanup() { scheduler.runOnce(); return cleanup.status(); }
}
