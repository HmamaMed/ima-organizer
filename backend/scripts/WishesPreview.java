import com.lifeorganizer.LifeOrganizerApplication;
import org.springframework.boot.SpringApplication;

/** Disposable loopback-only H2 + fake-S3 fixture for verify-wishes.mjs. */
public class WishesPreview {
    public static void main(String[] ignored) {
        SpringApplication.run(LifeOrganizerApplication.class,
                "--server.address=127.0.0.1", "--server.port=8087",
                "--spring.datasource.url=jdbc:h2:mem:wishespreview;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa",
                "--spring.datasource.password=", "--spring.jpa.hibernate.ddl-auto=create-drop",
                "--firebase.service-account-path=/nonexistent/wishes-preview.json",
                "--app.seed.owner-username=WishOwner", "--app.seed.recipient-username=WishRecipient",
                "--app.seed.owner-password=local-wishes-password", "--app.seed.recipient-password=local-wishes-password",
                "--app.birthdays.cron=-", "--app.memories.cleanup-cron=-", "--app.memories.orphan-cron=-",
                "--app.wishes.cleanup-cron=*/1 * * * * *",
                "--app.media.r2.endpoint=http://127.0.0.1:8091", "--app.media.r2.bucket=memory-test",
                "--app.media.r2.access-key-id=test-key", "--app.media.r2.secret-access-key=test-secret",
                "--app.cors.allowed-origins=http://127.0.0.1:5175");
    }
}
