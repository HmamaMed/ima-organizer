package com.lifeorganizer.media;

import com.lifeorganizer.memories.MemoryGroup;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "media_assets", indexes = @Index(name = "media_assets_group_idx", columnList = "group_id"))
public class MediaAsset {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false) private MemoryGroup group;
    @Column(nullable = false, unique = true, length = 250) private String objectKey;
    @Column(nullable = false, length = 100) private String contentType;
    @Column(nullable = false) private long size;
    @Column(nullable = false) private Instant createdAt;
    @Column(nullable = false) private boolean attached;
    protected MediaAsset() {}
    public MediaAsset(MemoryGroup group, String objectKey, String contentType, long size) {
        this.group = group; this.objectKey = objectKey; this.contentType = contentType; this.size = size; this.createdAt = Instant.now();
    }
    public UUID getId() { return id; }
    public MemoryGroup getGroup() { return group; }
    public String getObjectKey() { return objectKey; }
    public String getContentType() { return contentType; }
    public long getSize() { return size; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isAttached() { return attached; }
    public void attach() { if (attached) throw new IllegalStateException("This upload is already used by a memory"); attached = true; }
}
