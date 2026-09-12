package com.lifeorganizer.notes;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    /** Recipient feed — delivered notes only, newest delivered first. Never exposes scheduled/draft/cancelled notes. */
    List<Note> findByStatusOrderBySentAtDesc(NoteStatus status, Pageable pageable);

    /** Owner's workspace view — everything except cancelled notes, which the admin screen has no use for. */
    List<Note> findByStatusInOrderByCreatedAtDesc(List<NoteStatus> statuses, Pageable pageable);

    /** True if another active scheduled note already occupies this hour slot. */
    boolean existsByStatusAndScheduledFor(NoteStatus status, Instant scheduledFor);
}
