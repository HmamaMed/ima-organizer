package com.lifeorganizer.memories;

import com.lifeorganizer.media.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class MemoryService {
    private final MemoryRepository memories;
    private final MemoryGroupRepository groups;
    private final MediaAssetRepository assets;
    private final R2Storage storage;
    public MemoryService(MemoryRepository memories, MemoryGroupRepository groups, MediaAssetRepository assets, R2Storage storage) {
        this.memories = memories; this.groups = groups; this.assets = assets; this.storage = storage;
    }
    @Transactional
    public MemoryResponse create(MemoryRequest request) {
        MemoryGroup group = groups.lockById(request.groupId()).filter(g -> g.isVisible(Instant.now()))
                .orElseThrow(() -> new NoSuchElementException("Memory category not found or expired"));
        MediaAsset photo = attachment(request.photoAssetId(), group, "image/");
        MediaAsset audio = request.audioAssetId() == null ? null : attachment(request.audioAssetId(), group, "audio/");
        photo.attach(); if (audio != null) audio.attach();
        Memory memory = new Memory("r2://" + photo.getObjectKey(), request.caption(),
                audio == null ? null : "r2://" + audio.getObjectKey(), request.memoryDate());
        memory.setGroup(group); memory.setPhotoAsset(photo); memory.setAudioAsset(audio);
        return response(memories.save(memory), Instant.now());
    }
    private MediaAsset attachment(UUID id, MemoryGroup group, String type) {
        MediaAsset asset = assets.findById(id).orElseThrow(() -> new NoSuchElementException("Media upload not found"));
        if (!asset.getGroup().getId().equals(group.getId()) || !asset.getContentType().startsWith(type))
            throw new IllegalArgumentException("The selected media does not belong to this category or has the wrong type.");
        if (asset.isAttached()) throw new IllegalStateException("This upload has already been saved in a memory");
        return asset;
    }
    public List<MemoryResponse> list() {
        Instant now = Instant.now();
        return memories.findVisible(now).stream().map(m -> response(m, now)).toList();
    }
    private MemoryResponse response(Memory memory, Instant now) {
        Instant expiry = memory.getGroup().getExpiresAt();
        return new MemoryResponse(memory.getId(),
            memory.getPhotoAsset() == null ? memory.getPhotoUrl() : storage.readUrl(memory.getPhotoAsset().getObjectKey(), expiry, now),
            memory.getCaption(), memory.getAudioAsset() == null ? memory.getAudioUrl() : storage.readUrl(memory.getAudioAsset().getObjectKey(), expiry, now),
            memory.getMemoryDate(), memory.getCreatedAt(), memory.getGroup().getId(), expiry);
    }
    @Transactional
    public MemoryGroupResponse createGroup(MemoryGroupRequest request) {
        String description = request.description() == null ? null : request.description().trim();
        return MemoryGroupResponse.from(groups.save(new MemoryGroup(request.name().trim(),
                description == null || description.isEmpty() ? null : description)));
    }
    public List<MemoryGroupResponse> listGroups() {
        return groups.findVisible(Instant.now()).stream().map(MemoryGroupResponse::from).toList();
    }
    @Transactional
    public void deleteGroup(UUID id) {
        MemoryGroup group = groups.lockById(id).orElseThrow(() -> new NoSuchElementException("Memory category not found"));
        group.requestDeletion(Instant.now());
    }
}
