package com.lifeorganizer.watchlist;

import com.lifeorganizer.auth.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class WatchService {
    private final WatchRepository items;
    private final WatchReviewRepository reviews;
    public WatchService(WatchRepository items, WatchReviewRepository reviews) { this.items = items; this.reviews = reviews; }
    public List<WatchResponse> list() { return items.findAllByOrderByCreatedAtDescIdDesc().stream().map(this::response).toList(); }
    @Transactional
    public WatchResponse create(WatchRequest request) {
        WatchItem item = new WatchItem(Instant.now()); item.update(request); return response(items.saveAndFlush(item));
    }
    @Transactional
    public WatchResponse update(UUID id, WatchRequest request) { WatchItem item = find(id); item.update(request); return response(item); }
    @Transactional
    public WatchResponse status(UUID id, WatchItem.Status status) { WatchItem item = find(id); item.setStatus(status); return response(item); }
    @Transactional
    public WatchResponse review(UUID id, User user, WatchRequest.ReviewRequest request) {
        WatchItem item = find(id); // Serialize status changes, deletion and same-user review writes.
        if (item.getStatus() != WatchItem.Status.WATCHED) throw new IllegalStateException("Passez le titre en « Vu » pour donner votre avis.");
        WatchReview review = reviews.findByItemIdAndUserId(id, user.getId()).orElseGet(() -> new WatchReview(item, user));
        review.update(request); reviews.saveAndFlush(review); return response(item);
    }
    @Transactional
    public WatchResponse deleteReview(UUID id, User user) {
        WatchItem item = find(id);
        reviews.findByItemIdAndUserId(id, user.getId()).ifPresent(reviews::delete); reviews.flush(); return response(item);
    }
    @Transactional
    public void delete(UUID id) { WatchItem item = find(id); reviews.deleteByItemId(id); reviews.flush(); items.delete(item); }
    private WatchItem find(UUID id) { return items.lockById(id).orElseThrow(() -> new NoSuchElementException("Film ou série introuvable.")); }
    private WatchResponse response(WatchItem item) {
        var opinions = reviews.findByItemIdOrderByUpdatedAtAsc(item.getId()).stream().map(review ->
                new WatchResponse.ReviewResponse(review.getUser().getId(), review.getUser().getName(), review.getRating(), review.getComment(), review.getUpdatedAt())).toList();
        return new WatchResponse(item.getId(), item.getTitle(), item.getKind(), item.getStatus(), item.getNotes(), item.getCreatedAt(), opinions);
    }
}
