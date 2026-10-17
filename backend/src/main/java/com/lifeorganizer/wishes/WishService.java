package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.media.R2Storage;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class WishService {
    private final WishRepository wishes;
    private final WishPhotoRepository photos;
    private final R2Storage storage;
    public WishService(WishRepository wishes, WishPhotoRepository photos, R2Storage storage) {
        this.wishes = wishes; this.photos = photos; this.storage = storage;
    }
    public List<WishResponse> list() { return wishes.findAllByOrderByCreatedAtDescIdDesc().stream().map(this::response).toList(); }
    @Transactional
    public WishResponse create(User user, WishRequest request) {
        Wish wish = new Wish(Instant.now());
        apply(user, wish, request);
        return response(wishes.saveAndFlush(wish));
    }
    @Transactional
    public WishResponse update(User user, UUID id, WishRequest request) {
        Wish wish = find(id); apply(user, wish, request); return response(wish);
    }
    @Transactional
    public void delete(UUID id) {
        Wish wish = find(id);
        if (wish.getPhoto() != null) photos.lockById(wish.getPhoto().getId()).orElseThrow().queueDeletion(Instant.now());
        wishes.delete(wish);
    }
    private Wish find(UUID id) { return wishes.lockById(id).orElseThrow(() -> new NoSuchElementException("Envie introuvable.")); }
    private void apply(User user, Wish wish, WishRequest request) {
        WishPhoto old = wish.getPhoto();
        WishPhoto photo = old;
        if (!Objects.equals(request.photoId(), old == null ? null : old.getId())) {
            photo = request.photoId() == null ? null : photos.lockById(request.photoId())
                    .orElseThrow(() -> new NoSuchElementException("Photo introuvable."));
            if (photo != null) photo.attach(user, Instant.now());
            if (old != null) photos.lockById(old.getId()).orElseThrow().queueDeletion(Instant.now());
        }
        wish.update(request, photo);
    }
    private WishResponse response(Wish wish) {
        WishPhoto photo = wish.getPhoto();
        return new WishResponse(wish.getId(), wish.getTitle(), wish.getCategory(), wish.getDetails(), wish.getLink(),
                photo == null ? null : photo.getId(), photo == null ? null : storage.readUrl(photo.getObjectKey(), null, Instant.now()), wish.getCreatedAt());
    }
}
