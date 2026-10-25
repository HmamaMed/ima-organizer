package com.lifeorganizer.watchlist;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface WatchRepository extends JpaRepository<WatchItem, UUID> {
    List<WatchItem> findByCoupleIdOrderByCreatedAtDescIdDesc(UUID coupleId);

    @Query("select w from WatchItem w where w.coupleId = :coupleId and "
        + "(lower(w.title) like lower(:term) or lower(coalesce(w.notes,'')) like lower(:term)) "
        + "and (:kind is null or w.kind = :kind) and (:status is null or w.status = :status) order by w.createdAt desc,w.id desc")
    List<WatchItem> search(UUID coupleId,String term,WatchItem.Kind kind,WatchItem.Status status,org.springframework.data.domain.Pageable page);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from WatchItem w where w.id = :id and "
            + "(w.coupleId = :coupleId or (:coupleId is null and w.coupleId is null))")
    Optional<WatchItem> lockByIdAndCoupleId(UUID id, UUID coupleId);
}
