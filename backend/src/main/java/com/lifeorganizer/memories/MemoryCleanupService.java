package com.lifeorganizer.memories;

import com.lifeorganizer.media.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;

@Service
public class MemoryCleanupService {
    private final MemoryGroupRepository groups;
    private final MemoryRepository memories;
    private final MediaAssetRepository assets;
    private final R2Storage storage;
    private final R2Properties r2;
    private final LegacySupabaseStorage legacy;
    public MemoryCleanupService(MemoryGroupRepository groups, MemoryRepository memories, MediaAssetRepository assets,
                                R2Storage storage, R2Properties r2, LegacySupabaseStorage legacy) {
        this.groups = groups; this.memories = memories; this.assets = assets; this.storage = storage; this.r2 = r2; this.legacy = legacy;
    }
    /** Existing memories are explicitly being erased, not migrated or given a fresh lifetime. */
    @Transactional
    public void queueLegacy() {
        for (MemoryGroup old : groups.findByExpiresAtIsNull()) {
            groups.lockById(old.getId()).ifPresent(g -> g.requestDeletion(Instant.now()));
        }
        List<Memory> ungrouped = memories.findByGroupIsNull();
        if (!ungrouped.isEmpty()) {
            MemoryGroup group = groups.save(MemoryGroup.legacyCleanup());
            for (Memory memory : ungrouped) memory.setGroup(group);
        }
    }
    @Transactional
    public void purge(UUID id, Instant now) {
        MemoryGroup group = groups.lockById(id).orElse(null);
        if (group == null || group.isVisible(now)) return;
        // Retain DB references until every provider has confirmed file deletion.
        Set<String> oldFiles = new LinkedHashSet<>();
        for (Memory memory : memories.findByGroupId(id)) {
            if (memory.getPhotoAsset() == null && memory.getPhotoUrl() != null) oldFiles.add(memory.getPhotoUrl());
            if (memory.getAudioAsset() == null && memory.getAudioUrl() != null) oldFiles.add(memory.getAudioUrl());
        }
        for (String url : oldFiles) {
            if (!url.startsWith("r2://" + R2Storage.groupPrefix(id))) legacy.delete(url);
        }
        // Legacy categories never had R2 uploads; new categories always verify their whole prefix.
        if (group.getExpiresAt() != null || r2.configured() || !assets.findByGroupId(id).isEmpty()) storage.deleteGroup(id);
        memories.deleteByGroupId(id);
        memories.flush();
        assets.deleteByGroupId(id);
        assets.flush();
        groups.delete(group);
    }
    @Transactional
    public void removeAbandonedUploads(UUID groupId, Instant now) {
        MemoryGroup group = groups.lockById(groupId).orElse(null);
        if (group == null || !group.isVisible(now)) return;
        Instant cutoff = now.minus(Duration.ofHours(24));
        for (MediaAsset asset : assets.findByGroupId(groupId)) {
            if (!asset.isAttached() && asset.getCreatedAt().isBefore(cutoff)) {
                storage.deleteObject(asset.getObjectKey()); assets.delete(asset);
            }
        }
        // Also catch R2 writes whose DB transaction could not be committed.
        for (var object : storage.listGroup(groupId)) {
            if (object.lastModified().isBefore(cutoff) && !assets.existsByObjectKey(object.key())) storage.deleteObject(object.key());
        }
    }
    public Map<String, Object> status() {
        return Map.of("pendingCategories", groups.findDueIds(Instant.now()).size(),
                "r2Configured", r2.configured(), "legacyCleanupConfigured", legacy.configured());
    }
}
