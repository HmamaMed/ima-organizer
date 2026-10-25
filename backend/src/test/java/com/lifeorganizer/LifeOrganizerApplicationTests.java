package com.lifeorganizer;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:applicationcontext;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "firebase.service-account-path=/nonexistent/test-firebase.json",
    "app.wishes.cleanup-cron=-", "app.memories.cleanup-cron=-", "app.memories.orphan-cron=-", "app.birthdays.cron=-"
})
class LifeOrganizerApplicationTests {

	@Test
	void contextLoads() {
	}

}
