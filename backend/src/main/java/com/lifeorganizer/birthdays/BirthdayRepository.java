package com.lifeorganizer.birthdays;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface BirthdayRepository extends JpaRepository<BirthdayReminder, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from BirthdayReminder b where b.id = :id and b.user.id = :userId")
    Optional<BirthdayReminder> lockByIdAndUserId(UUID id,UUID userId);
    long countByUserId(UUID userId);
    List<BirthdayReminder> findByUserId(UUID userId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from BirthdayReminder b where b.id = :id")
    Optional<BirthdayReminder> lockById(UUID id);
    @Query("select b.id from BirthdayReminder b")
    List<UUID> findReminderIds();
}
