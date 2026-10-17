package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.media.*;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import java.io.*;
import java.time.Instant;
import java.util.*;

@Service
public class WishPhotoService {
    private static final Map<String,String> TYPES = Map.of("image/jpeg","jpg", "image/png","png", "image/webp","webp");
    private final WishPhotoRepository photos;
    private final WishPhotoLedger ledger;
    private final R2Storage storage;
    public WishPhotoService(WishPhotoRepository photos, WishPhotoLedger ledger, R2Storage storage) {
        this.photos = photos; this.ledger = ledger; this.storage = storage;
    }
    public record UploadResponse(UUID id) {}
    public UploadResponse upload(User user, MultipartFile file) {
        String type = MediaUploadService.type(file.getContentType());
        if (!TYPES.containsKey(type)) throw new IllegalArgumentException("Choisissez une photo JPEG, PNG ou WebP.");
        if (file.getSize() == 0 || file.getSize() > 10L * 1024 * 1024) throw new IllegalArgumentException("La photo doit faire entre 1 octet et 10 Mo.");
        // This repository transaction commits before the R2 write: failed uploads remain tracked.
        WishPhoto photo = photos.saveAndFlush(new WishPhoto(user, "wishes/" + UUID.randomUUID() + "." + TYPES.get(type), Instant.now()));
        try (InputStream input = file.getInputStream()) { storage.upload(photo.getObjectKey(), input, file.getSize(), type); }
        catch (IOException e) { throw new MediaStorageException("Impossible de lire la photo. Réessayez.", e); }
        ledger.ready(photo.getId());
        return new UploadResponse(photo.getId());
    }
}
