package com.lifeorganizer.wishes;

import com.lifeorganizer.media.R2Storage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
public class WishPhotoLedger {
    private final WishPhotoRepository photos;
    private final R2Storage storage;
    public WishPhotoLedger(WishPhotoRepository photos, R2Storage storage) { this.photos = photos; this.storage = storage; }
    @Transactional
    public void ready(UUID id) { photos.lockById(id).orElseThrow().markReady(); }
    @Transactional
    public void purge(UUID id, Instant now) {
        WishPhoto photo = photos.lockById(id).orElse(null);
        if (photo == null || !photo.isDue(now)) return;
        storage.deleteObject(photo.getObjectKey());
        photos.delete(photo);
    }
}
