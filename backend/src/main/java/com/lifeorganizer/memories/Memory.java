package com.lifeorganizer.memories;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import com.lifeorganizer.media.MediaAsset;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * A temporary memory. New files reference tracked private R2 assets; the URL
 * columns retain legacy cleanup references or an internal r2:// marker.
 */
@Entity
@Table(name = "memories")
public class Memory {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String photoUrl;

    @Column(length = 4000)
    private String caption;

    /** Optional audio URL in media storage. */
    @Column
    private String audioUrl;

    /** The date the memory happened — used for ordering the timeline. */
    @Column(nullable = false)
    private LocalDate memoryDate;

    @Column(nullable = false)
    private Instant createdAt;

    /** Nullable so all existing memories and older clients remain compatible. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id")
    private MemoryGroup group;

    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "photo_asset_id") private MediaAsset photoAsset;
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "audio_asset_id") private MediaAsset audioAsset;
    public MediaAsset getPhotoAsset() { return photoAsset; }
    public MediaAsset getAudioAsset() { return audioAsset; }
    public void setPhotoAsset(MediaAsset asset) { photoAsset = asset; }
    public void setAudioAsset(MediaAsset asset) { audioAsset = asset; }

    protected Memory() {
        // for JPA
    }

    public Memory(String photoUrl, String caption, String audioUrl, LocalDate memoryDate) {
        this.photoUrl = photoUrl;
        this.caption = caption;
        this.audioUrl = audioUrl;
        this.memoryDate = memoryDate;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public String getAudioUrl() {
        return audioUrl;
    }

    public void setAudioUrl(String audioUrl) {
        this.audioUrl = audioUrl;
    }

    public LocalDate getMemoryDate() {
        return memoryDate;
    }

    public void setMemoryDate(LocalDate memoryDate) {
        this.memoryDate = memoryDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public MemoryGroup getGroup() { return group; }

    public void setGroup(MemoryGroup group) { this.group = group; }
}
