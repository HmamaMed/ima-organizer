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
            .withProperty("spring.datasource.url","jdbc:postgresql://ep-example.eu-central-1.aws.neon.tech/app?sslmode=require")
            .withProperty("spring.flyway.url","jdbc:postgresql://ep-example.eu-central-1.aws.neon.tech/app?sslmode=require")
            .withProperty("spring.datasource.username","runtime").withProperty("spring.flyway.user","migrations")
            .withProperty("app.jwt.secret","production-test-jwt-secret-with-more-than-32-bytes")
            .withProperty("app.identity.token-secret","production-test-action-secret-with-more-than-32-bytes")
            .withProperty("spring.mail.host","smtp.example.test").withProperty("spring.mail.properties.mail.smtp.starttls.enable","true")
            .withProperty("spring.mail.properties.mail.smtp.auth","true").withProperty("spring.mail.username","test-login").withProperty("spring.mail.password","test-password")
            .withProperty("app.identity.mail-from","couples@example.test").withProperty("app.support-email","support@example.test")
            .withProperty("app.couples-firebase-path",credentials.toString()).withProperty("spring.jpa.hibernate.ddl-auto","validate")
            .withProperty("spring.flyway.enabled","true");
        env.setActiveProfiles("couples","couples-production");return env;
    }
    R2Properties storage(){return new R2Properties("https://private-storage.example.test","couples","test-key","test-secret");}
    @Test void acceptsSeparatedProductionConfiguration() throws Exception { assertThatCode(()->new CouplesProductionGuard(environment(),storage()).validate()).doesNotThrowAnyException(); }
    @Test void refusesNeonTransactionPoolerForRuntimeAndMigrations() throws Exception {
        for (String key:java.util.List.of("spring.datasource.url","spring.flyway.url")) {
            var env=environment();
            env.setProperty(key,"jdbc:postgresql://ep-example-pooler.eu-central-1.aws.neon.tech/app?sslmode=require");
            assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate())
                .isInstanceOf(IllegalStateException.class).hasMessageContaining("direct Neon connection URL").hasMessageContaining(key);
        }
    }
    @Test void refusesHttpAndSharedDatabaseRoles() throws Exception {
        var env=environment();env.setProperty("app.public-url","http://localhost:5174");assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class);
        env.setProperty("app.public-url","https://couples.example.test");env.setProperty("spring.datasource.username","migrations");assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class);
    }
    @Test void refusesDevelopmentSecretsAndMissingMediaConfiguration() throws Exception {
        var env=environment();env.setProperty("app.jwt.secret",env.getProperty("app.identity.token-secret"));assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(()->new CouplesProductionGuard(environment(),new R2Properties("","","","")).validate()).isInstanceOf(IllegalStateException.class);
    }
    @Test void refusesUnfilledSmtpCredentials() throws Exception {
        var env=environment();env.setProperty("spring.mail.password","REPLACE_WITH_SMTP_PASSWORD");
        assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class).hasMessageContaining("SMTP placeholders");
    }
    @Test void acceptsPrivateDeploymentWithoutSmtpCredentials() throws Exception {
        var env=environment();env.setProperty("app.identity.email-enabled","false");
        env.setProperty("app.identity.private-account-emails","owner@example.test,recipient@example.test");
        env.setProperty("spring.mail.host","");env.setProperty("spring.mail.username","");env.setProperty("spring.mail.password","");env.setProperty("app.identity.mail-from","");
        assertThatCode(()->new CouplesProductionGuard(env,storage()).validate()).doesNotThrowAnyException();
    }
    @Test void emailDisabledRequiresApprovedAccountsAndClosedRegistration() throws Exception {
        var env=environment();env.setProperty("app.identity.email-enabled","false");
        assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class).hasMessageContaining("private-account-emails");
        env.setProperty("app.identity.private-account-emails","owner@example.test");env.setProperty("app.identity.registration-enabled","true");
        assertThatThrownBy(()->new CouplesProductionGuard(env,storage()).validate()).isInstanceOf(IllegalStateException.class).hasMessageContaining("registration requires email");
    }
}
