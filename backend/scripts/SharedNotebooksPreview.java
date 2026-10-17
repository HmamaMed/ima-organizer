import com.lifeorganizer.LifeOrganizerApplication;
import org.springframework.boot.SpringApplication;

/** Disposable loopback-only H2 fixture for mobile/scripts/verify-shared-notebooks.mjs. */
public class SharedNotebooksPreview {
    public static void main(String[] ignored) {
        SpringApplication.run(LifeOrganizerApplication.class,
                "--server.address=127.0.0.1", "--server.port=8087",
                "--spring.datasource.url=jdbc:h2:mem:notebookpreview;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "--spring.datasource.driver-class-name=org.h2.Driver", "--spring.datasource.username=sa",
                "--spring.datasource.password=", "--spring.jpa.hibernate.ddl-auto=create-drop",
                "--firebase.service-account-path=/nonexistent/notebook-preview.json",
                "--app.seed.owner-username=NotebookOwner", "--app.seed.recipient-username=NotebookRecipient",
                "--app.seed.owner-password=local-notebooks-password", "--app.seed.recipient-password=local-notebooks-password",
                "--app.birthdays.cron=-", "--app.memories.cleanup-cron=-", "--app.memories.orphan-cron=-", "--app.wishes.cleanup-cron=-",
                "--app.cors.allowed-origins=http://127.0.0.1:5175");
    }
}
