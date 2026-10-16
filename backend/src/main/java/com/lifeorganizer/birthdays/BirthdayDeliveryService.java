package com.lifeorganizer.birthdays;

import com.lifeorganizer.push.PushService;
import com.lifeorganizer.notifications.BirthdayNotification;
import com.lifeorganizer.notifications.BirthdayNotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class BirthdayDeliveryService {
    private final BirthdayRepository reminders;
    private final BirthdayDeliveryRepository deliveries;
    private final PushService push;
    private final BirthdayNotificationRepository notifications;
    public BirthdayDeliveryService(BirthdayRepository reminders, BirthdayDeliveryRepository deliveries, PushService push,
                                   BirthdayNotificationRepository notifications) {
        this.reminders = reminders; this.deliveries = deliveries; this.push = push; this.notifications = notifications;
    }
    @Transactional
    public void deliver(UUID id, Instant now) {
        // Row lock + persistent unique receipt prevent competing workers/restarts from resending.
        Optional<BirthdayReminder> found = reminders.lockById(id);
        if (found.isEmpty()) return;
        BirthdayReminder reminder = found.get();
        ZonedDateTime local = now.atZone(MoroccoTime.zone(reminder.getTimeZone(), now));
        if (local.getHour() < 19) return;
        LocalDate birthday = BirthdayDates.nextOccurrence(reminder.getMonth(), reminder.getDay(), local.toLocalDate());
        int days = (int) ChronoUnit.DAYS.between(local.toLocalDate(), birthday);
        if (days != 3 && days != 1) return;
        String body = "“" + reminder.getLabel() + "” is in " + days + (days == 1 ? " day." : " days.");
        if (!notifications.existsForOccurrence(id, birthday, days)) {
            notifications.saveAndFlush(new BirthdayNotification(reminder.getUser(), id, birthday, days,
                    "Birthday reminder", body, now));
        }
        if (deliveries.existsByReminderIdAndBirthdayDateAndDaysBefore(id, birthday, days)) return;
        boolean accepted = push.sendToUser(reminder.getUser(), "Birthday reminder", body,
                Map.of("route", "/notifications", "reminderId", id.toString(), "birthdayDate", birthday.toString()));
        // A missing token or failed send remains retryable for the rest of this local day.
        if (accepted) deliveries.saveAndFlush(new BirthdayDelivery(reminder, birthday, days, now));
    }
}
