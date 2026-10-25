package com.lifeorganizer.config;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.couples.CoupleService;
import com.lifeorganizer.identity.*;
import com.lifeorganizer.jobs.JobStore;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.jwt.secret=private-test-jwt-secret-longer-than-32-characters",
    "app.identity.token-secret=private-test-action-secret-longer-than-32-characters", "app.jobs.enabled=false",
    "app.couples-firebase-path=", "app.identity.email-enabled=false", "app.identity.registration-enabled=true",
    "app.identity.private-account-emails=owner@example.test,recipient@example.test"})
@ActiveProfiles("couples")
@AutoConfigureMockMvc
@Testcontainers
class PrivateAccountsIntegrationTests {
    @Container static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",postgres::getJdbcUrl);
        registry.add("spring.datasource.username",postgres::getUsername);
        registry.add("spring.datasource.password",postgres::getPassword);
    }
    @org.springframework.test.context.bean.override.mockito.MockitoBean JavaMailSender mail;
    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired IdentityService identity;
    @Autowired IdentityEmailHandler emails;
    @Autowired CoupleService couples;
    @Autowired JwtService jwt;
    @Autowired SecretTokens tokens;
    User owner,recipient,other;
    @BeforeEach void accounts() {
        reset(mail);
        jdbc.execute("truncate table users,couples,outbox_jobs,deletion_markers cascade");
        owner=users.saveAndFlush(new User("owner@example.test","Owner",passwords.encode("existing-password"),"fr","UTC"));
        recipient=users.saveAndFlush(new User("recipient@example.test","Recipient",passwords.encode("existing-password"),"fr","UTC"));
        other=new User("other@example.test","Other",passwords.encode("existing-password"),"fr","UTC");other.verifyEmail();other=users.saveAndFlush(other);
    }
    IdentityService.Credentials login(User user) { return identity.login(new IdentityService.Login(user.getEmail(),"existing-password","Test")); }
    @Test void approvedAccountsSignInWithoutVerificationAndCanPair() throws Exception {
        mvc.perform(get("/api/identity/config")).andExpect(status().isOk())
            .andExpect(jsonPath("$.emailEnabled").value(false)).andExpect(jsonPath("$.registrationEnabled").value(false));
        mvc.perform(post("/api/identity/login").contentType("application/json").content("""
            {"email":"owner@example.test","password":"existing-password","deviceName":"Test"}
            """)).andExpect(status().isOk()).andExpect(jsonPath("$.user.emailVerified").value(false))
            .andExpect(jsonPath("$.user.emailVerificationRequired").value(false));
        var credentials=login(owner);
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+credentials.token())).andExpect(status().isOk())
            .andExpect(jsonPath("$.emailVerified").value(false)).andExpect(jsonPath("$.emailVerificationRequired").value(false));
        couples.create(owner);
        var invitation=couples.invite(owner,recipient.getEmail());
        assertThat(couples.accept(recipient,invitation.token()).status()).isEqualTo("ACTIVE");
        assertThat(identity.refresh(credentials.refreshToken()).user().emailVerificationRequired()).isFalse();
        assertThat(jdbc.queryForObject("select count(*) from identity_actions",Integer.class)).isZero();
        verifyNoInteractions(mail);
    }
    @Test void disabledEmailCannotRegisterOrRequestVerificationOrRecovery() throws Exception {
        mvc.perform(post("/api/identity/register").contentType("application/json").content("""
            {"email":"new@example.test","password":"new-long-password","name":"New","locale":"fr","timeZone":"UTC"}
            """)).andExpect(status().isForbidden());
        for(String route:List.of("verification-email","password-email"))
            mvc.perform(post("/api/identity/"+route).contentType("application/json").content("{\"email\":\"owner@example.test\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/identity/verify").contentType("application/json").content("{\"token\":\"old-token\"}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/identity/reset-password").contentType("application/json").content("{\"token\":\"old-token\",\"password\":\"new-long-password\"}")).andExpect(status().isForbidden());
        assertThat(jdbc.queryForObject("select count(*) from identity_actions",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from outbox_jobs where kind='IDENTITY_EMAIL'",Integer.class)).isZero();
        verifyNoInteractions(mail);
    }
    @Test void aVerifiedNonapprovedAccountCannotLoginRefreshOrReuseASession() throws Exception {
        mvc.perform(post("/api/identity/login").contentType("application/json").content("""
            {"email":"other@example.test","password":"existing-password","deviceName":"Test"}
            """)).andExpect(status().isUnauthorized());
        UUID session=UUID.randomUUID();String refresh=session+"."+tokens.random();
        jdbc.update("insert into refresh_sessions(id,user_id,token_hash,device_name,authenticated_at,expires_at) values (?,?,?,'Old session',current_timestamp,current_timestamp+interval '1 day')",session,other.getId(),SecretTokens.hash(refresh));
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+jwt.generateToken(other,session))).andExpect(status().isUnauthorized());
        assertThatThrownBy(()->identity.refresh(refresh)).isInstanceOf(InvalidCredentialsException.class);
    }
    @Test void previouslyQueuedEmailCannotContactTheProvider() {
        UUID challenge=UUID.randomUUID();
        jdbc.update("insert into identity_actions(id,user_id,kind,token_hash,expires_at) values (?,?,'VERIFY',?,current_timestamp+interval '1 day')",challenge,owner.getId(),SecretTokens.hash(tokens.action(challenge)));
        emails.process(new JobStore.Job(UUID.randomUUID(),"IDENTITY_EMAIL",challenge,null,UUID.randomUUID(),1));
        verifyNoInteractions(mail);
    }
}
