package com.lifeorganizer.birthdays;

import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.UUID;

@Component
public class BirthdayScheduler {
    private static final Logger log = LoggerFactory.getLogger(BirthdayScheduler.class);
    private final BirthdayRepository reminders;
    private final BirthdayDeliveryService delivery;
    public BirthdayScheduler(BirthdayRepository reminders, BirthdayDeliveryService delivery) {
        this.reminders = reminders; this.delivery = delivery;
    }
    @Scheduled(cron = "${app.birthdays.cron:0 */5 * * * *}")
    public void deliverDueReminders() {
        Instant now = Instant.now();
        for (UUID id : reminders.findReminderIds()) {
            try { delivery.deliver(id, now); }
            catch (Exception e) { log.error("Birthday reminder {} could not be delivered; will retry", id, e); }
        }
    }
}
