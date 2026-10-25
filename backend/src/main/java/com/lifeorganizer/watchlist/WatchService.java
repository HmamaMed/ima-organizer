package com.lifeorganizer.watchlist;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.couples.CoupleAccess;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class WatchService {
    private final WatchRepository items;
    private final WatchReviewRepository reviews;
    private final CoupleAccess access;

    public WatchService(WatchRepository items, WatchReviewRepository reviews, CoupleAccess access) {
        this.items = items; this.reviews = reviews; this.access = access;
    }

    public List<WatchResponse> list(User user) { return list(user,0,100,"",null,null); }
    public List<WatchResponse> list(User user,int page,int size,String search,WatchItem.Kind kind,WatchItem.Status status) {
        UUID scope=access.requireScope(user);
        if(search.length()>100)throw new IllegalArgumentException("Search must be 100 characters or shorter");
        var result=scope==null ? items.findByCoupleIdOrderByCreatedAtDescIdDesc(null) : items.search(scope,"%"+search.trim()+"%",kind,status,org.springframework.data.domain.PageRequest.of(Math.max(page,0),Math.clamp(size,1,100)));
        return result.stream().map(this::response).toList();
    }

    @Transactional
    public WatchResponse create(User user, WatchRequest request) {
        UUID scope = access.requireScopeForWrite(user);
        WatchItem item = new WatchItem(Instant.now(), scope, user);
        item.update(request);
        return response(items.saveAndFlush(item));
    }

    @Transactional
    public WatchResponse update(UUID id, User user, WatchRequest request) {
        WatchItem item = find(id, user); item.update(request); return response(item);
    }

    @Transactional
    public WatchResponse status(UUID id, User user, WatchItem.Status status) {
        WatchItem item = find(id, user); item.setStatus(status); return response(item);
    }

    @Transactional
    public WatchResponse review(UUID id, User user, WatchRequest.ReviewRequest request) {
        WatchItem item = find(id, user); // Serialize status changes, deletion and same-user review writes.
        if (item.getStatus() != WatchItem.Status.WATCHED) throw new IllegalStateException("Passez le titre en « Vu » pour donner votre avis.");
        WatchReview review = reviews.findByItemIdAndUserIdAndCoupleId(id, user.getId(), item.getCoupleId())
                .orElseGet(() -> new WatchReview(item, user));
        review.update(request); reviews.saveAndFlush(review); return response(item);
    }

    @Transactional
    public WatchResponse deleteReview(UUID id, User user) {
        WatchItem item = find(id, user);
        reviews.findByItemIdAndUserIdAndCoupleId(id, user.getId(), item.getCoupleId()).ifPresent(reviews::delete);
        reviews.flush(); return response(item);
    }

    @Transactional
    public void delete(UUID id, User user) {
        WatchItem item = find(id, user);
        reviews.deleteByItemIdAndCoupleId(id, item.getCoupleId()); reviews.flush(); items.delete(item);
    }

    private WatchItem find(UUID id, User user) {
        UUID scope = access.requireScopeForWrite(user);
        return items.lockByIdAndCoupleId(id, scope).orElseThrow(() -> new NoSuchElementException("Film ou série introuvable."));
    }

    private WatchResponse response(WatchItem item) {
        var opinions = reviews.findByItemIdAndCoupleIdOrderByUpdatedAtAsc(item.getId(), item.getCoupleId()).stream().map(review ->
                new WatchResponse.ReviewResponse(review.getUser().getId(), review.getUser().getName(), review.getRating(), review.getComment(), review.getUpdatedAt())).toList();
        return new WatchResponse(item.getId(), item.getTitle(), item.getKind(), item.getStatus(), item.getNotes(), item.getCreatedAt(), opinions);
    }
}
