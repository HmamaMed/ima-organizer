package com.lifeorganizer.notifications;

import org.springframework.data.jpa.repository.*;
import java.time.LocalDate;
import java.util.*;

public interface BirthdayNotificationRepository extends JpaRepository<BirthdayNotification, UUID> {
    List<BirthdayNotification> findByUserIdAndDismissedFalseOrderByCreatedAtDescIdDesc(UUID userId);
    @Query("select count(n) > 0 from BirthdayNotification n where n.reminderId = :reminderId and n.birthdayDate = :birthdayDate and n.daysBefore = :daysBefore")
    boolean existsForOccurrence(UUID reminderId, LocalDate birthdayDate, int daysBefore);
    // Keep the occurrence marker so a push retry cannot recreate a deleted inbox message.
    @Modifying
    @Query("update BirthdayNotification n set n.dismissed = true where n.id = :id and n.user.id = :userId and n.dismissed = false")
    int dismiss(UUID id, UUID userId);
}
