package com.lifeorganizer.birthdays;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.UUID;

public interface BirthdayDeliveryRepository extends JpaRepository<BirthdayDelivery, UUID> {
    @Query("select count(d) > 0 from BirthdayDelivery d where d.reminder.id = :reminderId and d.birthdayDate = :birthdayDate and d.daysBefore = :daysBefore")
    boolean existsByReminderIdAndBirthdayDateAndDaysBefore(UUID reminderId, LocalDate birthdayDate, int daysBefore);
    void deleteByReminderId(UUID reminderId);
}
