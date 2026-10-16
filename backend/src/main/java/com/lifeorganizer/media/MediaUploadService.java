package com.lifeorganizer.media;

import com.lifeorganizer.memories.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.time.Instant;
import java.util.*;

@Service
public class MediaUploadService {
    private static final Map<String, String> TYPES = Map.ofEntries(
        Map.entry("image/jpeg","jpg"), Map.entry("image/png","png"), Map.entry("image/webp","webp"),
        Map.entry("audio/webm","webm"), Map.entry("audio/mp4","m4a"), Map.entry("audio/aac","aac"),
        Map.entry("audio/ogg","ogg"), Map.entry("audio/mpeg","mp3"), Map.entry("audio/wav","wav"),
        Map.entry("audio/3gpp","3gp"), Map.entry("audio/x-m4a","m4a"));
    private final MemoryGroupRepository groups;
    private final MediaAssetRepository assets;
    private final R2Storage storage;
    public MediaUploadService(MemoryGroupRepository groups, MediaAssetRepository assets, R2Storage storage) {
        this.groups = groups; this.assets = assets; this.storage = storage;
    }
    public record UploadResponse(UUID id) {}
    public static String type(String value) { return value == null ? "" : value.split(";",2)[0].trim().toLowerCase(Locale.ROOT); }
    @Transactional
    public UploadResponse upload(UUID groupId, MultipartFile file) {
        MemoryGroup group = groups.lockById(groupId).filter(g -> g.isVisible(Instant.now()))
                .orElseThrow(() -> new NoSuchElementException("Memory category not found or expired"));
        String type = type(file.getContentType());
        if (!TYPES.containsKey(type)) throw new IllegalArgumentException("Choose a JPEG, PNG or WebP photo, or a supported audio recording.");
        if (file.getSize() <= 0 || file.getSize() > 25L * 1024 * 1024) throw new IllegalArgumentException("Files must be between 1 byte and 25 MB.");
        String key = R2Storage.groupPrefix(groupId) + UUID.randomUUID() + "." + TYPES.get(type);
        MediaAsset asset = assets.save(new MediaAsset(group,key,type,file.getSize()));
        try (InputStream input = file.getInputStream()) { storage.upload(key,input,file.getSize(),type); }
        catch (IOException e) { throw new MediaStorageException("Could not read this file. Please try again.",e); }
        return new UploadResponse(asset.getId());
    }
}
