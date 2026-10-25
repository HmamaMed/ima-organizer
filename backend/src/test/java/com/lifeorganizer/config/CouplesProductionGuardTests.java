package com.lifeorganizer.config;

import com.lifeorganizer.media.R2Properties;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.env.MockEnvironment;
import java.nio.file.*;
import static org.assertj.core.api.Assertions.*;

class CouplesProductionGuardTests {
    @TempDir Path directory;
    MockEnvironment environment() throws Exception {
        Path credentials=Files.writeString(directory.resolve("firebase.json"),"{}");
        var env=new MockEnvironment().withProperty("app.public-url","https://couples.example.test")
            .withProperty("spring.datasource.username","runtime").withProperty("spring.flyway.user","migrations")
            .withProperty("app.jwt.secret","production-test-jwt-secret-with-more-than-32-bytes")
            .withProperty("app.identity.token-secret","production-test-action-secret-with-more-than-32-bytes")
            .withProperty("spring.mail.host","smtp.example.test").withProperty("spring.mail.properties.mail.smtp.starttls.enable","true")
            .withProperty("app.identity.mail-from","couples@example.test").withProperty("app.support-email","support@example.test")
            .withProperty("app.couples-firebase-path",credentials.toString()).withProperty("spring.jpa.hibernate.ddl-auto","validate")
            .withProperty("spring.flyway.enabled","true");
        env.setActiveProfiles("couples","couples-production");return env;
    }
    R2Properties storage(){return new R2Properties("https://private-storage.example.test","couples","test-key","test-secret");}
    @Test void acceptsSeparatedProductionConfiguration() throws Exception { assertThatCode(()->new CouplesProductionGuard(environment(),storage()).validate()).doesNotThrowAnyException(); }
    @Test void refusesHttpAndSharedDatabaseRoles() throws Exception {
        var env=environment();env.setProperty("app.public-url","http://localhost:5174");assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class);
        env.setProperty("app.public-url","https://couples.example.test");env.setProperty("spring.datasource.username","migrations");assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class);
    }
    @Test void refusesDevelopmentSecretsAndMissingMediaConfiguration() throws Exception {
        var env=environment();env.setProperty("app.jwt.secret",env.getProperty("app.identity.token-secret"));assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->new CouplesProductionGuard(environment(),new R2Properties("","","","")).validate()).isInstanceOf(IllegalStateException.class);
    }
}
