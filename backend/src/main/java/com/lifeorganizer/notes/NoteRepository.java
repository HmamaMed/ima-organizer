package com.lifeorganizer.notes;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface NoteRepository extends JpaRepository<Note, UUID> {

    /** Feed, newest first. */
    List<Note> findAllByOrderByCreatedAtDesc(Pageable pageable);

    /** Notes due to be sent by the scheduler. */
    List<Note> findByStatusAndScheduledForLessThanEqual(NoteStatus status, Instant now);
}
