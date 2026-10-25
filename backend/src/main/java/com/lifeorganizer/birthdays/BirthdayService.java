package com.lifeorganizer.birthdays;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.auth.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Transactional(readOnly = true)
public class BirthdayService {
    private final BirthdayRepository reminders;
    private final BirthdayDeliveryRepository deliveries;
    private final UserRepository users;
    private final boolean couplesMode;
    public BirthdayService(BirthdayRepository reminders, BirthdayDeliveryRepository deliveries, UserRepository users,org.springframework.core.env.Environment environment) {
        couplesMode=environment.acceptsProfiles(org.springframework.core.env.Profiles.of("couples"));
        this.reminders = reminders; this.deliveries = deliveries; this.users = users;
    }
    public List<BirthdayResponse> list(User user) {
        Instant now = Instant.now();
        return reminders.findByUserId(user.getId()).stream().map(b -> BirthdayResponse.from(b, now, couplesMode))
                .sorted(Comparator.comparingLong(BirthdayResponse::daysUntil)
                        .thenComparing(BirthdayResponse::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(BirthdayResponse::id)).toList();
    }
    @Transactional
    public BirthdayResponse create(User user, BirthdayRequest request) {
        if(couplesMode){ users.lockById(user.getId()).orElseThrow();if(reminders.countByUserId(user.getId())>=100)throw new IllegalStateException("You can keep up to 100 birthday reminders"); }
        return BirthdayResponse.from(reminders.save(new BirthdayReminder(
                users.getReferenceById(user.getId()), request)), Instant.now(), couplesMode);
    }
    @Transactional
    public BirthdayResponse update(User user, UUID id, BirthdayRequest request) {
        BirthdayReminder reminder = owned(user, id);
        reminder.update(request);
        return BirthdayResponse.from(reminder, Instant.now(), couplesMode);
    }
    @Transactional
    public void delete(User user, UUID id) {
        BirthdayReminder reminder = owned(user, id);
        deliveries.deleteByReminderId(id);
        reminders.delete(reminder);
    }
    private BirthdayReminder owned(User user, UUID id) {
        // The same lock also serializes edits/deletes with scheduler delivery.
        return reminders.lockByIdAndUserId(id,user.getId())
                .orElseThrow(() -> new NoSuchElementException("Birthday reminder not found"));
    }
}
