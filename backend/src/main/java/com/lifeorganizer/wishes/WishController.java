package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@RequestMapping("/api/wishes")
public class WishController {
    private final WishService wishes;
    private final WishPhotoService photos;
    public WishController(WishService wishes, WishPhotoService photos) { this.wishes = wishes; this.photos = photos; }
    @GetMapping
    public List<WishResponse> list() { return wishes.list(); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('RECIPIENT')")
    public WishResponse create(@AuthenticationPrincipal User user, @Valid @RequestBody WishRequest request) { return wishes.create(user, request); }
    @PutMapping("/{id}") @PreAuthorize("hasRole('RECIPIENT')")
    public WishResponse update(@AuthenticationPrincipal User user, @PathVariable UUID id, @Valid @RequestBody WishRequest request) { return wishes.update(user, id, request); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) @PreAuthorize("hasRole('RECIPIENT')")
    public void delete(@PathVariable UUID id) { wishes.delete(id); }
    @PostMapping(value = "/photos", consumes = "multipart/form-data") @ResponseStatus(HttpStatus.CREATED) @PreAuthorize("hasRole('RECIPIENT')")
    public WishPhotoService.UploadResponse upload(@AuthenticationPrincipal User user, @RequestParam("file") MultipartFile file) { return photos.upload(user, file); }
}
