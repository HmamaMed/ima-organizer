import com.lifeorganizer.LifeOrganizerApplication;
import com.lifeorganizer.auth.*;
import com.lifeorganizer.birthdays.*;
import org.springframework.boot.SpringApplication;
import java.time.Instant;

/** Disposable local-only H2 fixture for mobile/scripts/verify-notifications.mjs. */
public class NotificationInboxPreview {
    public static void main(String[] ignored) {
        var context = SpringApplication.run(LifeOrganizerApplication.class,
                "--server.address=127.0.0.1", "--server.port=8087",
                "--spring.datasource.url=jdbc:h2:mem:notificationpreview;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa",
                "--spring.datasource.password=", "--spring.jpa.hibernate.ddl-auto=create-drop",
                "--firebase.service-account-path=/nonexistent/notification-preview.json",
                "--app.seed.owner-username=NotificationOwner", "--app.seed.recipient-username=NotificationPartner",
                "--app.seed.owner-password=local-notification-password", "--app.seed.recipient-password=local-notification-password",
                "--app.birthdays.cron=-", "--app.memories.cleanup-cron=-", "--app.memories.orphan-cron=-",
                "--app.cors.allowed-origins=http://127.0.0.1:5175");
        var users = context.getBean(UserRepository.class);
        var birthdays = context.getBean(BirthdayService.class);
        var delivery = context.getBean(BirthdayDeliveryService.class);
        for (var role : Role.values()) {
            var user = users.findByRole(role).orElseThrow();
            var birthday = birthdays.create(user, new BirthdayRequest(
                    role == Role.OWNER ? "Sister’s birthday" : "Mum’s birthday", 10, 20, "Africa/Casablanca"));
            delivery.deliver(birthday.id(), Instant.parse("2026-10-17T19:00:00Z"));
            delivery.deliver(birthday.id(), Instant.parse("2026-10-19T19:00:00Z"));
        }
        System.out.println("NOTIFICATION_PREVIEW_READY");
    }
}
