package com.lifeorganizer.couples;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.watchlist.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real PostgreSQL is required: do not replace partial indexes/locking with H2 coverage. */
@SpringBootTest(properties = {"app.jwt.secret=couples-test-signing-key-with-at-least-32-characters",
    "app.identity.token-secret=couples-test-action-secret-with-at-least-32-characters", "app.jobs.enabled=false", "app.identity.registration-enabled=true", "app.couples-firebase-path="})
@ActiveProfiles("couples")
@AutoConfigureMockMvc
@Testcontainers
class CouplesPostgresIntegrationTests {
    @Container static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }

    @org.springframework.test.context.bean.override.mockito.MockitoBean com.lifeorganizer.media.R2Storage storage;
    @org.springframework.test.context.bean.override.mockito.MockitoBean org.springframework.mail.javamail.JavaMailSender mail;
    @Autowired com.lifeorganizer.identity.IdentityService identity;
    @Autowired com.lifeorganizer.identity.SecretTokens tokens;
    @Autowired CoupleService pairing;
    @Autowired com.lifeorganizer.jobs.JobRunner runner;
    @Autowired com.lifeorganizer.jobs.JobStore jobStore;
    @Autowired com.lifeorganizer.notes.CoupleNoteService notes;
    @Autowired com.lifeorganizer.memories.CoupleMemoryService moments;
    @Autowired com.lifeorganizer.notifications.PartnerNotifications notifications;
    @Autowired com.lifeorganizer.recipes.CoupleRecipeService recipes;
    @Autowired com.lifeorganizer.wishes.CoupleWishService wishes;
    @Autowired com.lifeorganizer.birthdays.BirthdayService birthdays;
    @Autowired com.lifeorganizer.birthdays.CoupleBirthdayJobs birthdayJobs;
    @Autowired com.lifeorganizer.privacy.DeletionRestoreGuard restoreGuard;
    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired CoupleRepository couples;
    @Autowired CoupleMembershipRepository memberships;
    @Autowired WatchService watch;
    @Autowired JwtService jwt;
    @Autowired Flyway flyway;
    @Autowired ApplicationContext context;
    @Autowired PlatformTransactionManager transactions;
    User a, b, c, d, unpaired;
    UUID first, second;
    static final String FILM = "{\"title\":\"Our film\",\"kind\":\"FILM\",\"status\":\"WATCHED\"}";

    @BeforeEach void fixtures() {
        org.mockito.Mockito.reset(storage,mail);
        org.mockito.Mockito.when(storage.readUrl(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(Instant.class),org.mockito.ArgumentMatchers.any(Instant.class)))
                .thenAnswer(call -> "https://private.test/" + call.getArgument(0));
        jdbc.execute("truncate table deletion_requests, deletion_markers, support_reports, outbox_jobs, abuse_limits, watch_reviews, watch_items, couple_memberships, couples, users cascade");
        // Repeated legacy roles deliberately prove that role lookup cannot select a partner.
        a = account("A", Role.OWNER); b = account("B", Role.RECIPIENT);
        c = account("C", Role.OWNER); d = account("D", Role.RECIPIENT);
        unpaired = account("Unpaired", Role.OWNER);
        first = pair(a, b); second = pair(c, d);
    }

    User account(String name, Role role) { return users.saveAndFlush(new User(role, name, "unused-test-hash")); }
    UUID pair(User left, User right) {
        return new TransactionTemplate(transactions).execute(tx -> {
            Couple couple = couples.saveAndFlush(new Couple(Instant.now()));
            memberships.save(new CoupleMembership(couple, left, 1, Instant.now()));
            memberships.save(new CoupleMembership(couple, right, 2, Instant.now()));
            couple.activate();
            return couple.getId();
        });
    }
    String auth(User user) {
        UUID id=UUID.randomUUID();
        jdbc.update("insert into refresh_sessions (id,user_id,token_hash,device_name,authenticated_at,expires_at) values (?,?,?,'Test',current_timestamp,current_timestamp+interval '1 day')",id,user.getId(),com.lifeorganizer.identity.SecretTokens.hash(tokens.random()));
        return "Bearer " + jwt.generateToken(user,id);
    }
    UUID film(User user) { return watch.create(user, new WatchRequest("Private film", WatchItem.Kind.FILM, WatchItem.Status.WATCHED, null)).id(); }

    @Test void freshMigrationsValidateAndLegacyBackgroundWritersAreAbsent() {
        flyway.validate();
        assertThat(flyway.info().applied()).hasSize(8);
        assertThat(flyway.migrate().migrationsExecuted).isZero();
        for (String bean : List.of("dataSeeder", "gymPlanSeeder", "schemaFixups", "noteScheduler", "memoryCleanupScheduler", "wishPhotoCleanup", "birthdayScheduler", "firebaseConfig")) {
            assertThat(context.containsBean(bean)).as(bean).isFalse();
        }
        assertThat(context.getBeansOfType(org.springframework.boot.CommandLineRunner.class)).isEmpty();
        assertThat(context.getBean(org.springframework.scheduling.annotation.ScheduledAnnotationBeanPostProcessor.class).getScheduledTasks()).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from programmes", Integer.class)).isZero();
        assertThat(users.count()).isEqualTo(5);
    }

    @Test void couplesSeeOnlyTheirOwnTitlesAndBothPartnersCanManageThem() throws Exception {
        UUID own = film(a), other = film(c);
        for (User member : List.of(a, b)) {
            mvc.perform(get("/api/watchlist").header("Authorization", auth(member)))
                    .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                    .andExpect(jsonPath("$[0].id").value(own.toString()));
            mvc.perform(put("/api/watchlist/" + own).header("Authorization", auth(member)).contentType("application/json").content(FILM))
                    .andExpect(status().isOk());
        }
        mvc.perform(get("/api/watchlist").header("Authorization", auth(d)))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(other.toString()));
        mvc.perform(post("/api/watchlist").header("Authorization", auth(b)).contentType("application/json").content(FILM))
                .andExpect(status().isCreated());
        assertThat(jdbc.queryForObject("select couple_id from watch_items where id = ?", UUID.class, own)).isEqualTo(first);
        assertThat(jdbc.queryForObject("select created_by_id from watch_items where id = ?", UUID.class, own)).isEqualTo(a.getId());
    }

    @Test void everyMutationHidesForeignResourceIdsAndLeavesDataUntouched() throws Exception {
        UUID foreign = film(c);
        for (User member : List.of(a, b)) {
            mvc.perform(put("/api/watchlist/" + foreign).header("Authorization", auth(member)).contentType("application/json").content(FILM)).andExpect(status().isNotFound());
            mvc.perform(patch("/api/watchlist/" + foreign + "/status").header("Authorization", auth(member)).contentType("application/json").content("{\"status\":\"IN_PROGRESS\"}")).andExpect(status().isNotFound());
            mvc.perform(put("/api/watchlist/" + foreign + "/review").header("Authorization", auth(member)).contentType("application/json").content("{\"rating\":5}")).andExpect(status().isNotFound());
            mvc.perform(delete("/api/watchlist/" + foreign + "/review").header("Authorization", auth(member))).andExpect(status().isNotFound());
            mvc.perform(delete("/api/watchlist/" + foreign).header("Authorization", auth(member))).andExpect(status().isNotFound());
        }
        assertThat(watch.list(c)).hasSize(1);
        assertThat(jdbc.queryForObject("select count(*) from watch_reviews", Integer.class)).isZero();
    }

    @Test void reviewsBelongToTheAuthenticatedPartnerAndDeletingATitleCleansThemUp() throws Exception {
        UUID id = film(a);
        for (User member : List.of(a, b)) {
            mvc.perform(put("/api/watchlist/" + id + "/review").header("Authorization", auth(member)).contentType("application/json")
                    .content("{\"rating\":5,\"userId\":\"" + c.getId() + "\"}")).andExpect(status().isOk());
        }
        assertThat(watch.list(a).getFirst().reviews()).extracting(WatchResponse.ReviewResponse::userId).containsExactlyInAnyOrder(a.getId(), b.getId());
        mvc.perform(delete("/api/watchlist/" + id + "/review").header("Authorization", auth(b)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.reviews.length()").value(1)).andExpect(jsonPath("$.reviews[0].userId").value(a.getId().toString()));
        mvc.perform(delete("/api/watchlist/" + id).header("Authorization", auth(b))).andExpect(status().isNoContent());
        assertThat(jdbc.queryForObject("select count(*) from watch_reviews", Integer.class)).isZero();
    }

    @Test void endedMembershipAndClosedCoupleDenyPreviouslyIssuedTokens() throws Exception {
        UUID id = film(a);
        String oldToken = auth(a);
        jdbc.update("update couple_memberships set left_at = current_timestamp where user_id = ?", a.getId());
        mvc.perform(get("/api/watchlist").header("Authorization", oldToken)).andExpect(status().isForbidden());
        mvc.perform(post("/api/watchlist").header("Authorization", oldToken).contentType("application/json").content(FILM)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/watchlist/" + id).header("Authorization", oldToken)).andExpect(status().isForbidden());
        jdbc.update("update couples set status = 'CLOSED', closed_at = current_timestamp where id = ?", first);
        mvc.perform(get("/api/watchlist").header("Authorization", auth(b))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/watchlist/" + id).header("Authorization", auth(b))).andExpect(status().isForbidden());
    }

    @Test void unpairedUsersAndUnauthenticatedRequestsCannotUseAnyWatchlistOperation() throws Exception {
        UUID id = film(a);
        for (String credential : List.of("", auth(unpaired))) {
            int expected = credential.isEmpty() ? 401 : 403;
            mvc.perform(get("/api/watchlist").header("Authorization", credential)).andExpect(status().is(expected));
            mvc.perform(post("/api/watchlist").header("Authorization", credential).contentType("application/json").content(FILM)).andExpect(status().is(expected));
            mvc.perform(put("/api/watchlist/" + id).header("Authorization", credential).contentType("application/json").content(FILM)).andExpect(status().is(expected));
            mvc.perform(patch("/api/watchlist/" + id + "/status").header("Authorization", credential).contentType("application/json").content("{\"status\":\"WATCHED\"}")).andExpect(status().is(expected));
            mvc.perform(put("/api/watchlist/" + id + "/review").header("Authorization", credential).contentType("application/json").content("{\"rating\":5}")).andExpect(status().is(expected));
            mvc.perform(delete("/api/watchlist/" + id + "/review").header("Authorization", credential)).andExpect(status().is(expected));
            mvc.perform(delete("/api/watchlist/" + id).header("Authorization", credential)).andExpect(status().is(expected));
        }
    }

    @Test void unfinishedModulesAndUnknownEndpointsAreDenied() throws Exception {
        for (String path : List.of("gym/programmes", "agios", "auth/push-token", "push/test", "auth/register", "future-module")) {
            mvc.perform(get("/api/" + path).header("Authorization", auth(a))).andExpect(status().isForbidden());
            mvc.perform(post("/api/" + path).header("Authorization", auth(a)).contentType("application/json").content("{}")).andExpect(status().isForbidden());
        }
        mvc.perform(put("/api/auth/push-token").header("Authorization", auth(a)).contentType("application/json").content("{\"token\":\"test-token\"}")).andExpect(status().isForbidden());
        mvc.perform(delete("/api/auth/push-token").header("Authorization", auth(a))).andExpect(status().isForbidden());

    }

    @Test void databaseRejectsMissingScopeAndCrossCoupleAuthorsAndChildren() {
        UUID id = film(a);
        assertThatThrownBy(() -> jdbc.update("update watch_items set couple_id = null where id = ?", id)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update watch_items set created_by_id = ? where id = ?", c.getId(), id)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertReview(id, second, c.getId())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertReview(id, first, c.getId())).isInstanceOf(DataIntegrityViolationException.class);
    }

    void insertReview(UUID item, UUID couple, UUID user) {
        jdbc.update("insert into watch_reviews (id, item_id, couple_id, user_id, rating, updated_at) values (?, ?, ?, ?, 5, current_timestamp)", UUID.randomUUID(), item, couple, user);
    }

    @Test void databaseEnforcesMembershipCapacityAndAllowsNewPairingAfterClosure() {
        assertThatThrownBy(() -> insertMembership(first, unpaired.getId(), 3)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertMembership(first, unpaired.getId(), 1)).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> insertMembership(second, a.getId(), 2)).isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("update couple_memberships set left_at = current_timestamp where couple_id = ?", first);
        jdbc.update("update couples set status = 'CLOSED', closed_at = current_timestamp where id = ?", first);
        UUID newSpace = pair(a, unpaired);
        assertThat(newSpace).isNotEqualTo(first);
        assertThat(watch.list(a)).isEmpty();
    }

    void insertMembership(UUID couple, UUID user, int slot) {
        jdbc.update("insert into couple_memberships (id, couple_id, user_id, slot, joined_at) values (?, ?, ?, ?, current_timestamp)", UUID.randomUUID(), couple, user, slot);
    }

    @Test void aWriteWaitingForTheCoupleLockRechecksClosureBeforeSaving() throws Exception {
        try (var executor = Executors.newSingleThreadExecutor()) {
            Future<WatchResponse> pending = new TransactionTemplate(transactions).execute(tx -> {
                jdbc.queryForObject("select id from couples where id = ? for update", UUID.class, first);
                Future<WatchResponse> write = executor.submit(() -> watch.create(a,
                        new WatchRequest("Stale write", WatchItem.Kind.FILM, WatchItem.Status.TO_WATCH, null)));
                long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
                // Wait for PostgreSQL to confirm the writer is blocked, rather than assuming thread timing.
                while (jdbc.queryForObject("select count(*) from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock'", Integer.class) == 0) {
                    if (System.nanoTime() > deadline) throw new AssertionError("Writer did not wait for the couple lock");
                    try { Thread.sleep(20); }
                    catch (InterruptedException interrupted) { Thread.currentThread().interrupt(); throw new AssertionError(interrupted); }
                }
                // Keep the membership row active to exercise the refreshed CLOSED status specifically.
                jdbc.update("update couples set status = 'CLOSED', closed_at = current_timestamp where id = ?", first);
                return write;
            });
            assertThatThrownBy(() -> pending.get(10, TimeUnit.SECONDS))
                    .hasCauseInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        }
        assertThat(jdbc.queryForObject("select count(*) from watch_items", Integer.class)).isZero();
    }

    @Test void migrationsRefuseUnclassifiedContentAndPreserveVerifiedOwnershipOnUpgrade() {
        String schema = "upgrade_" + UUID.randomUUID().toString().replace("-", "");
        var versionOne = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/couples").schemas(schema).defaultSchema(schema).target("1").load();
        var latest = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                .locations("classpath:db/couples").schemas(schema).defaultSchema(schema).load();
        try {
            versionOne.migrate();
            UUID item = UUID.randomUUID(), member = UUID.randomUUID(), couple = UUID.randomUUID();
            jdbc.update("insert into " + schema + ".users (id, name, role, password_hash) values (?, 'Fixture', 'OWNER', 'test')", member);
            jdbc.update("insert into " + schema + ".couples (id, status, created_at) values (?, 'WAITING', current_timestamp)", couple);
            jdbc.update("insert into " + schema + ".couple_memberships (id, couple_id, user_id, slot, joined_at) values (?, ?, ?, 1, current_timestamp)", UUID.randomUUID(), couple, member);
            jdbc.update("insert into " + schema + ".watch_items (id, title, kind, status, created_at) values (?, 'Preserved title', 'FILM', 'TO_WATCH', current_timestamp)", item);
            assertThatThrownBy(latest::migrate).isInstanceOf(org.flywaydb.core.api.FlywayException.class);
            // Ownership must be explicitly classified before strict constraints can be installed.
            jdbc.update("update " + schema + ".watch_items set couple_id = ?, created_by_id = ? where id = ?", couple, member, item);
            assertThat(latest.migrate().migrationsExecuted).isEqualTo(7);
            latest.validate();
            assertThat(jdbc.queryForObject("select title from " + schema + ".watch_items where id = ?", String.class, item)).isEqualTo("Preserved title");
            assertThat(jdbc.queryForObject("select couple_id from " + schema + ".watch_items where id = ?", UUID.class, item)).isEqualTo(couple);
        } finally {
            jdbc.execute("drop schema if exists " + schema + " cascade");
        }
    }

    @Test void aNonemptyDatabaseWithoutMigrationHistoryIsNeverAutomaticallyBaselined() {
        String schema = "untracked_" + UUID.randomUUID().toString().replace("-", "");
        try {
            jdbc.execute("create schema " + schema);
            jdbc.execute("create table " + schema + ".personal_fixture (id integer)");
            var untracked = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
                    .locations("classpath:db/couples").schemas(schema).defaultSchema(schema).baselineOnMigrate(false).load();
            assertThatThrownBy(untracked::migrate).isInstanceOf(org.flywaydb.core.api.FlywayException.class)
                    .hasMessageContaining("non-empty");
            assertThat(jdbc.queryForObject("select count(*) from information_schema.tables where table_schema = ? and table_name = 'personal_fixture'", Integer.class, schema)).isEqualTo(1);
        } finally {
            jdbc.execute("drop schema if exists " + schema + " cascade");
        }
    }

    User verifiedAccount(String email) {
        identity.register(new com.lifeorganizer.identity.IdentityService.Register(email,"Partner","correct-horse-password","fr","Africa/Casablanca"));
        User user=users.findByEmail(email.toLowerCase(Locale.ROOT)).orElseThrow();
        UUID action=jdbc.queryForObject("select id from identity_actions where user_id=? and kind='VERIFY' and consumed_at is null",UUID.class,user.getId());
        identity.verify(tokens.action(action));
        return users.findById(user.getId()).orElseThrow();
    }
    com.lifeorganizer.identity.IdentityService.Credentials signIn(User user) {
        return identity.login(new com.lifeorganizer.identity.IdentityService.Login(user.getEmail(),"correct-horse-password","Test phone"));
    }
    org.springframework.mock.web.MockMultipartFile photo() throws Exception {
        var bytes=new java.io.ByteArrayOutputStream();
        javax.imageio.ImageIO.write(new java.awt.image.BufferedImage(8,8,java.awt.image.BufferedImage.TYPE_INT_RGB),"png",bytes);
        return new org.springframework.mock.web.MockMultipartFile("file","photo.png","image/png",bytes.toByteArray());
    }
    com.lifeorganizer.memories.CoupleMemoryService.Group group(User user) {
        return moments.createGroup(user,new com.lifeorganizer.memories.MemoryGroupRequest("Our moments",null),UUID.randomUUID());
    }
    com.lifeorganizer.memories.CoupleMemoryService.Moment moment(User user,UUID group) throws Exception {
        var upload=moments.upload(user,group,photo());
        return moments.create(user,new com.lifeorganizer.memories.MemoryRequest(upload.id(),"A shared photo",null,java.time.LocalDate.now(),group),UUID.randomUUID());
    }

    @Test void registrationQueuesRealEmailWithoutPersistingBearerTokensAndVerificationIsSingleUse() throws Exception {
        mvc.perform(post("/api/identity/register").contentType("application/json").content("""
            {"email":"NEW@EXAMPLE.TEST","name":"New partner","password":"correct-horse-password","locale":"fr","timeZone":"Africa/Casablanca"}
            """)).andExpect(status().isAccepted());
        User user=users.findByEmail("new@example.test").orElseThrow();
        assertThat(user.getPasswordHash()).isNotEqualTo("correct-horse-password");
        assertThat(user.isEmailVerified()).isFalse();
        assertThatThrownBy(()->pairing.create(user)).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        UUID action=jdbc.queryForObject("select id from identity_actions where user_id=?",UUID.class,user.getId());
        assertThat(jdbc.queryForObject("select token_hash from identity_actions where id=?",String.class,action)).isEqualTo(com.lifeorganizer.identity.SecretTokens.hash(tokens.action(action)));
        runner.runBatch();
        var message=org.mockito.ArgumentCaptor.forClass(org.springframework.mail.SimpleMailMessage.class);
        org.mockito.Mockito.verify(mail).send(message.capture());
        assertThat(message.getValue().getText()).contains("/verify#token="+tokens.action(action));
        mvc.perform(post("/api/identity/verify").contentType("application/json").content("{\"token\":\""+tokens.action(action)+"\"}")).andExpect(status().isNoContent());
        mvc.perform(post("/api/identity/verify").contentType("application/json").content("{\"token\":\""+tokens.action(action)+"\"}")).andExpect(status().isBadRequest());
        assertThat(users.findById(user.getId()).orElseThrow().isEmailVerified()).isTrue();
    }

    @Test void refreshRotationDetectsReplayAndRevokesTheEntireSession() throws Exception {
        User user=verifiedAccount("rotation@example.test");var credentials=signIn(user);
        var renewed=identity.refresh(credentials.refreshToken());
        assertThat(renewed.refreshToken()).isNotEqualTo(credentials.refreshToken());
        assertThat(jdbc.queryForObject("select token_hash from refresh_sessions where user_id=?",String.class,user.getId())).isEqualTo(com.lifeorganizer.identity.SecretTokens.hash(renewed.refreshToken()));
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+renewed.token())).andExpect(status().isOk());
        assertThatThrownBy(()->identity.refresh(credentials.refreshToken())).isInstanceOf(InvalidCredentialsException.class);
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+renewed.token())).andExpect(status().isUnauthorized());
        assertThatThrownBy(()->identity.refresh(renewed.refreshToken())).isInstanceOf(InvalidCredentialsException.class);
    }

    @Test void passwordResetRevokesSessionsAndDevicesAndResetTokensCannotBeReplayed() throws Exception {
        User user=verifiedAccount("reset@example.test");var credentials=signIn(user);
        UUID session=jwt.extractSessionId(credentials.token());
        jdbc.update("insert into device_registrations(id,user_id,session_id,fcm_token,platform) values (?,?,?,'private-test-device','ANDROID')",UUID.randomUUID(),user.getId(),session);
        identity.emailAction(user.getEmail(),"RESET");
        UUID action=jdbc.queryForObject("select id from identity_actions where user_id=? and kind='RESET'",UUID.class,user.getId());
        var reset=new com.lifeorganizer.identity.IdentityService.Reset(tokens.action(action),"a-new-correct-password");
        identity.reset(reset);
        assertThatThrownBy(()->identity.reset(reset)).isInstanceOf(IllegalArgumentException.class);
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+credentials.token())).andExpect(status().isUnauthorized());
        assertThat(jdbc.queryForObject("select count(*) from device_registrations where user_id=? and revoked_at is null",Integer.class,user.getId())).isZero();
        assertThatThrownBy(()->signIn(user)).isInstanceOf(InvalidCredentialsException.class);
        assertThat(identity.login(new com.lifeorganizer.identity.IdentityService.Login(user.getEmail(),"a-new-correct-password","phone")).token()).isNotBlank();
    }

    @Test void invitationsBindVerifiedAccountsAndOnlyOneConcurrentAcceptanceCanCommit() throws Exception {
        User inviter=verifiedAccount("inviter@example.test"),left=verifiedAccount("left@example.test"),right=verifiedAccount("right@example.test");
        UUID couple=pairing.create(inviter).coupleId();var invite=pairing.invite(inviter,null);
        assertThat(pairing.preview(left,invite.token()).inviterName()).isEqualTo(inviter.getName());
        assertThat(jdbc.queryForObject("select token_hash from couple_invitations where couple_id=?",String.class,couple)).isEqualTo(com.lifeorganizer.identity.SecretTokens.hash(invite.token()));
        CountDownLatch start=new CountDownLatch(1);
        try(var executor=Executors.newFixedThreadPool(2)) {
            var results=new ArrayList<Future<Boolean>>();
            for(User candidate:List.of(left,right)) results.add(executor.submit(()->{start.await();try{pairing.accept(candidate,invite.token());return true;}catch(NoSuchElementException|IllegalStateException conflict){return false;}}));
            start.countDown();int accepted=0;for(var result:results)if(result.get(10,TimeUnit.SECONDS))accepted++;
            assertThat(accepted).isEqualTo(1);
        }
        assertThat(pairing.current(inviter).members()).hasSize(2);
        assertThat(jdbc.queryForObject("select count(*) from couple_memberships where couple_id=? and left_at is null",Integer.class,couple)).isEqualTo(2);
        assertThatThrownBy(()->pairing.accept(unpaired,invite.token())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
    }

    @Test void intendedRecipientExpiryRevocationAndAlreadyPairedAccountsAreChecked() {
        User inviter=verifiedAccount("invite-owner@example.test"),target=verifiedAccount("target@example.test"),wrong=verifiedAccount("wrong@example.test");
        pairing.create(inviter);var restricted=pairing.invite(inviter,target.getEmail());
        assertThatThrownBy(()->pairing.accept(wrong,restricted.token())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        pairing.revokeInvitation(inviter);
        assertThatThrownBy(()->pairing.accept(target,restricted.token())).isInstanceOf(NoSuchElementException.class);
        var expired=pairing.invite(inviter,null);
        jdbc.update("update couple_invitations set expires_at=current_timestamp-interval '1 minute' where token_hash=?",com.lifeorganizer.identity.SecretTokens.hash(expired.token()));
        assertThatThrownBy(()->pairing.accept(target,expired.token())).isInstanceOf(NoSuchElementException.class);
        pairing.create(target);var valid=pairing.invite(inviter,null);
        assertThatThrownBy(()->pairing.accept(target,valid.token())).isInstanceOf(IllegalStateException.class);
    }

    @Test void notesWorkInBothDirectionsWhileDraftsAndUnsentMutationsStayAuthorOnly() throws Exception {
        var draft=notes.create(a,new com.lifeorganizer.notes.CoupleNoteService.Input("Secret draft",com.lifeorganizer.notes.CoupleNoteService.Mode.DRAFT,null),UUID.randomUUID());
        mvc.perform(get("/api/notes/"+draft.id()).header("Authorization",auth(b))).andExpect(status().isNotFound());
        mvc.perform(put("/api/notes/"+draft.id()).header("Authorization",auth(b)).contentType("application/json").content("{\"content\":\"Stolen draft\",\"mode\":\"SEND\"}")).andExpect(status().isNotFound());
        notes.update(a,draft.id(),new com.lifeorganizer.notes.CoupleNoteService.Input("For B",com.lifeorganizer.notes.CoupleNoteService.Mode.SEND,null));
        var reverse=notes.create(b,new com.lifeorganizer.notes.CoupleNoteService.Input("For A",com.lifeorganizer.notes.CoupleNoteService.Mode.SEND,null),UUID.randomUUID());
        assertThat(notes.list(a,"received",0,100)).extracting(com.lifeorganizer.notes.CoupleNoteService.NoteView::id).containsExactly(reverse.id());
        assertThat(notes.list(b,"received",0,100)).extracting(com.lifeorganizer.notes.CoupleNoteService.NoteView::id).containsExactly(draft.id());
        assertThat(notes.list(a,"sent",0,100)).hasSize(1);assertThat(notes.list(b,"sent",0,100)).hasSize(1);
        assertThatThrownBy(()->notes.cancel(a,draft.id())).isInstanceOf(NoSuchElementException.class);
        mvc.perform(get("/api/notes/"+draft.id()).header("Authorization",auth(c))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/notes/"+draft.id()).header("Authorization",auth(c))).andExpect(status().isNotFound());
        assertThat(notifications.inbox(a,0,100)).hasSize(1);assertThat(notifications.inbox(b,0,100)).hasSize(1);assertThat(notifications.inbox(c,0,100)).isEmpty();
    }

    @Test void repeatedNoteCreationIsIdempotentAndRecipientAndSenderCannotBeForged() throws Exception {
        UUID requestId=UUID.randomUUID();String header=auth(a);
        String body="{\"content\":\"Hello\",\"mode\":\"SEND\",\"senderId\":\""+c.getId()+"\",\"recipientId\":\""+d.getId()+"\"}";
        for(int i=0;i<2;i++)mvc.perform(post("/api/notes").header("Authorization",header).header("Idempotency-Key",requestId.toString()).contentType("application/json").content(body)).andExpect(status().isCreated()).andExpect(jsonPath("$.senderId").value(a.getId().toString())).andExpect(jsonPath("$.recipientId").value(b.getId().toString()));
        assertThat(jdbc.queryForObject("select count(*) from notes",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from partner_notifications",Integer.class)).isEqualTo(1);
    }

    @Test void competingWorkersDeliverAllDueNotesWithOneInboxEntryPerNote() throws Exception {
        for(int i=0;i<60;i++)notes.create(i%2==0?a:b,new com.lifeorganizer.notes.CoupleNoteService.Input("Scheduled "+i,com.lifeorganizer.notes.CoupleNoteService.Mode.SCHEDULE,Instant.now().plusSeconds(3600)),UUID.randomUUID());
        assertThat(notes.list(a,"received",0,100)).isEmpty();
        jdbc.update("update notes set scheduled_for=current_timestamp-interval '1 minute' where status='SCHEDULED'");
        jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp-interval '1 minute' where kind='NOTE_DELIVERY'");
        try(var executor=Executors.newFixedThreadPool(2)) {
            var left=executor.submit(()->{for(int i=0;i<3;i++)runner.runBatch();});var right=executor.submit(()->{for(int i=0;i<3;i++)runner.runBatch();});left.get(20,TimeUnit.SECONDS);right.get(20,TimeUnit.SECONDS);
        }
        assertThat(jdbc.queryForObject("select count(*) from notes where status='SENT'",Integer.class)).isEqualTo(60);
        assertThat(jdbc.queryForObject("select count(*) from partner_notifications",Integer.class)).isEqualTo(60);
        assertThat(jdbc.queryForObject("select count(*) from outbox_jobs where kind='NOTE_DELIVERY' and state<>'DONE'",Integer.class)).isZero();
    }

    @Test void bothPartnersPublishMemoriesAndOnlyCreatorsCanMutateOrUploadToTheirGroups() throws Exception {
        var left=group(a);var right=group(b);var foreign=group(c);
        var one=moment(a,left.id());var two=moment(b,right.id());moment(c,foreign.id());
        assertThat(moments.list(a,null,0,100)).extracting(com.lifeorganizer.memories.CoupleMemoryService.Moment::id).containsExactlyInAnyOrder(one.id(),two.id());
        assertThat(moments.list(b,null,0,100)).hasSize(2);assertThat(moments.list(c,null,0,100)).hasSize(1);
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/memories/groups/"+left.id()+"/media").file(photo()).header("Authorization",auth(b))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/memories/groups/"+left.id()).header("Authorization",auth(b))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/memories/"+one.id()).header("Authorization",auth(b))).andExpect(status().isNotFound());
        mvc.perform(get("/api/memories/"+one.id()).header("Authorization",auth(c))).andExpect(status().isNotFound());
        assertThat(one.expiresAt()).isEqualTo(left.expiresAt());
        assertThat(notifications.inbox(a,0,100)).hasSize(1);assertThat(notifications.inbox(b,0,100)).hasSize(1);
        assertThatThrownBy(()->jdbc.update("update memories set creator_id=? where id=?",c.getId(),one.id())).isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(()->jdbc.update("update media_assets set couple_id=? where group_id=?",second,left.id())).isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test void spoofedMediaIsRejectedAndFailedCleanupRetainsExactReferencesUntilRetry() throws Exception {
        var own=group(a);var foreign=group(c);var other=moment(c,foreign.id());
        var invalid=new org.springframework.mock.web.MockMultipartFile("file","fake.png","image/png","not an image".getBytes());
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart("/api/memories/groups/"+own.id()+"/media").file(invalid).header("Authorization",auth(a))).andExpect(status().isBadRequest());
        var entry=moment(a,own.id());moments.delete(a,entry.id());
        org.mockito.Mockito.doThrow(new com.lifeorganizer.media.MediaStorageException("Unavailable")).when(storage).deleteObject(org.mockito.ArgumentMatchers.startsWith("couples/"+first+"/"));
        runner.runBatch();
        assertThat(moments.list(a,null,0,100)).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from media_assets where couple_id=?",Integer.class,first)).isEqualTo(1);
        org.mockito.Mockito.doNothing().when(storage).deleteObject(org.mockito.ArgumentMatchers.anyString());
        jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp where kind='MEMORY_ENTRY_CLEANUP'");runner.runBatch();
        assertThat(jdbc.queryForObject("select count(*) from media_assets where couple_id=?",Integer.class,first)).isZero();
        assertThat(moments.get(c,other.id()).id()).isEqualTo(other.id());
    }

    @Test void disconnectCancelsOldDeliveriesBlocksInflightUploadsAndRejectsStaleRelationshipWrites() throws Exception {
        var own=group(a);
        notes.create(a,new com.lifeorganizer.notes.CoupleNoteService.Input("Do not deliver",com.lifeorganizer.notes.CoupleNoteService.Mode.SCHEDULE,Instant.now().plusSeconds(100)),UUID.randomUUID());
        org.mockito.Mockito.doAnswer(call->{pairing.disconnect(a);return null;}).when(storage).upload(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.any(java.io.InputStream.class),org.mockito.ArgumentMatchers.anyLong(),org.mockito.ArgumentMatchers.anyString());
        assertThatThrownBy(()->moments.upload(a,own.id(),photo())).isInstanceOf(org.springframework.security.access.AccessDeniedException.class);
        assertThat(pairing.current(b).status()).isEqualTo("DISCONNECTED");
        assertThat(jdbc.queryForObject("select count(*) from notes where status='SCHEDULED'",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from outbox_jobs where kind='NOTE_DELIVERY' and state='CANCELLED'",Integer.class)).isEqualTo(1);
        a.verifyEmail();users.saveAndFlush(a);pairing.create(a);
        mvc.perform(post("/api/notes").header("Authorization",auth(a)).header("X-Couple-Id",first.toString()).header("Idempotency-Key",UUID.randomUUID().toString()).contentType("application/json").content("{\"content\":\"Stale\",\"mode\":\"DRAFT\"}")).andExpect(status().isConflict());
        runner.runBatch();assertThat(jdbc.queryForObject("select count(*) from media_assets where couple_id=?",Integer.class,first)).isZero();
    }

    @Test void expiringGroupsDoNotExtendWhenEditedAndImmediatelyStopSignedReads() throws Exception {
        var own=group(a);var entry=moment(a,own.id());
        assertThat(moments.editGroup(a,own.id(),new com.lifeorganizer.memories.MemoryGroupRequest("Edited",null)).expiresAt()).isEqualTo(own.expiresAt());
        jdbc.update("update memory_groups set expires_at=current_timestamp-interval '1 second' where id=?",own.id());
        assertThat(moments.list(a,null,0,100)).isEmpty();assertThatThrownBy(()->moments.get(b,entry.id())).isInstanceOf(NoSuchElementException.class);
        jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp where kind='MEMORY_CLEANUP'");runner.runBatch();
        assertThat(jdbc.queryForObject("select count(*) from memory_groups where id=?",Integer.class,own.id())).isZero();
    }

    @Test void loginRateLimitsPersistAcrossFailedAuthenticationAttempts() throws Exception {
        verifiedAccount("limited@example.test");
        for(int i=0;i<10;i++)mvc.perform(post("/api/identity/login").contentType("application/json").content("{\"email\":\"limited@example.test\",\"password\":\"wrong\",\"deviceName\":\"phone\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/identity/login").contentType("application/json").content("{\"email\":\"limited@example.test\",\"password\":\"wrong\",\"deviceName\":\"phone\"}")).andExpect(status().isTooManyRequests());
    }

    @Test void deletionRevokesImmediatelyAndRetriesMediaFailureUntilTheAccountIsPhysicallyRemoved() throws Exception {
        var own=group(a);moment(a,own.id());var foreign=group(c);var foreignEntry=moment(c,foreign.id());
        notes.create(a,new com.lifeorganizer.notes.CoupleNoteService.Input("Delete this note",com.lifeorganizer.notes.CoupleNoteService.Mode.SEND,null),UUID.randomUUID());
        film(a);film(c);String oldToken=auth(a);
        org.mockito.Mockito.doThrow(new com.lifeorganizer.media.MediaStorageException("Provider offline")).when(storage).deleteObject(org.mockito.ArgumentMatchers.startsWith("couples/"+first+"/"));
        mvc.perform(post("/api/privacy/deletion").header("Authorization",oldToken)).andExpect(status().isAccepted());
        mvc.perform(get("/api/identity/me").header("Authorization",oldToken)).andExpect(status().isUnauthorized());
        assertThat(pairing.current(b).status()).isEqualTo("DISCONNECTED");runner.runBatch();
        assertThat(users.existsById(a.getId())).isTrue();
        assertThat(jdbc.queryForObject("select state from deletion_requests where user_id=?",String.class,a.getId())).isEqualTo("QUEUED");
        org.mockito.Mockito.doNothing().when(storage).deleteObject(org.mockito.ArgumentMatchers.anyString());
        jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp where kind in ('ACCOUNT_DELETION','MEMORY_CLEANUP') and state='READY'");runner.runBatch();
        assertThat(users.existsById(a.getId())).isFalse();assertThat(users.existsById(c.getId())).isTrue();
        assertThat(jdbc.queryForObject("select state from deletion_requests where user_id=?",String.class,a.getId())).isEqualTo("COMPLETE");
        assertThat(jdbc.queryForObject("select count(*) from deletion_markers where user_id=?",Integer.class,a.getId())).isEqualTo(1);
        assertThat(moments.get(c,foreignEntry.id()).id()).isEqualTo(foreignEntry.id());
    }

    @Test void privacyExportContainsOnlyTheRequestersContributionsAndRequiresRecentAuthentication() throws Exception {
        notes.create(a,new com.lifeorganizer.notes.CoupleNoteService.Input("My private draft",com.lifeorganizer.notes.CoupleNoteService.Mode.DRAFT,null),UUID.randomUUID());
        notes.create(b,new com.lifeorganizer.notes.CoupleNoteService.Input("Partner private draft",com.lifeorganizer.notes.CoupleNoteService.Mode.DRAFT,null),UUID.randomUUID());
        String token=auth(a);
        mvc.perform(get("/api/privacy/export").header("Authorization",token)).andExpect(status().isOk()).andExpect(jsonPath("$.privateNotes.length()").value(1)).andExpect(jsonPath("$.privateNotes[0].content").value("My private draft"));
        jdbc.update("update refresh_sessions set authenticated_at=current_timestamp-interval '11 minutes' where id=?",jwt.extractSessionId(token.substring(7)));
        mvc.perform(get("/api/privacy/export").header("Authorization",token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/couples/disconnect").header("Authorization",token)).andExpect(status().isForbidden());
    }

    @Test void explicitLogoutRevokesOnlyThatSessionAndTheAssociatedDevice() throws Exception {
        User user=verifiedAccount("logout@example.test");var left=signIn(user);var right=signIn(user);
        mvc.perform(post("/api/identity/devices").header("Authorization","Bearer "+left.token()).contentType("application/json").content("{\"token\":\"test-device-token\",\"platform\":\"ANDROID\"}")).andExpect(status().isNoContent());
        mvc.perform(post("/api/identity/logout").header("Authorization","Bearer "+left.token())).andExpect(status().isNoContent());
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+left.token())).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+right.token())).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from device_registrations where user_id=? and revoked_at is null",Integer.class,user.getId())).isZero();
    }

    com.lifeorganizer.recipes.RecipeRequest recipeInput(String title) {
        return new com.lifeorganizer.recipes.RecipeRequest(title,com.lifeorganizer.recipes.Recipe.Status.TO_TRY,2,20,List.of(new com.lifeorganizer.recipes.RecipeRequest.Ingredient("Lemon","1")),List.of("Cook."),null);
    }
    @Test void recipesScopeReadsSearchMutationsAndChildReferencesWhileBothPartnersCanEdit() throws Exception {
        var own=recipes.create(a,recipeInput("Private recipe"),UUID.randomUUID());var foreign=recipes.create(c,recipeInput("Foreign recipe"),UUID.randomUUID());
        assertThat(recipes.list(a,0,100,"Lemon")).extracting(com.lifeorganizer.recipes.RecipeResponse::id).containsExactly(own.id());
        assertThat(recipes.update(b,own.id(),recipeInput("Edited together")).title()).isEqualTo("Edited together");
        mvc.perform(get("/api/recipes/"+foreign.id()).header("Authorization",auth(a))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/recipes/"+foreign.id()).header("Authorization",auth(b))).andExpect(status().isNotFound());
        assertThatThrownBy(()->jdbc.update("update recipe_steps set couple_id=? where recipe_id=?",second,own.id())).isInstanceOf(DataIntegrityViolationException.class);
        recipes.delete(b,own.id());assertThat(recipes.list(c,0,100,"")).hasSize(1);
    }
    @Test void wishesAreReadableByPartnersButOnlyTheirOwnerCanEditOrAttachPhotos() throws Exception {
        UUID photo=wishes.upload(a,photo()).id();
        var body=new com.lifeorganizer.wishes.WishRequest("My book",com.lifeorganizer.wishes.WishCategory.BOOK,null,"https://example.test/book",photo);
        var wish=wishes.create(a,body,UUID.randomUUID());
        assertThat(wishes.list(b,0,100)).extracting(com.lifeorganizer.wishes.CoupleWishService.Wish::ownerId).containsExactly(a.getId());
        assertThatThrownBy(()->wishes.update(b,wish.id(),body)).isInstanceOf(NoSuchElementException.class);
        assertThatThrownBy(()->wishes.create(b,body,UUID.randomUUID())).isInstanceOf(NoSuchElementException.class);
        assertThatThrownBy(()->wishes.create(c,body,UUID.randomUUID())).isInstanceOf(NoSuchElementException.class);
        mvc.perform(get("/api/wishes/"+wish.id()).header("Authorization",auth(c))).andExpect(status().isNotFound());
        jdbc.update("update wish_photos set created_at=current_timestamp-interval '4 days' where id=?",photo);
        runner.runBatch();assertThat(wishes.get(a,wish.id()).photoId()).isEqualTo(photo);
        wishes.delete(a,wish.id());runner.runBatch();
        assertThat(jdbc.queryForObject("select count(*) from wish_photos where id=?",Integer.class,photo)).isZero();
    }
    @Test void birthdayRemindersAndTheirDurableNotificationsStayPersonalAcrossDisconnect() throws Exception {
        a.verifyEmail();users.saveAndFlush(a);
        var reminder=birthdays.create(a,new com.lifeorganizer.birthdays.BirthdayRequest("Personal birthday",11,7,"UTC"));
        mvc.perform(get("/api/birthdays").header("Authorization",auth(b))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete("/api/birthdays/"+reminder.id()).header("Authorization",auth(b))).andExpect(status().isNotFound());
        birthdayJobs.plan(reminder.id(),Instant.parse("2026-11-04T18:59:00Z"));
        assertThat(jdbc.queryForObject("select count(*) from birthday_notifications",Integer.class)).isZero();
        birthdayJobs.plan(reminder.id(),Instant.parse("2026-11-04T19:00:00Z"));birthdayJobs.plan(reminder.id(),Instant.parse("2026-11-04T20:00:00Z"));
        assertThat(jdbc.queryForObject("select count(*) from birthday_notifications",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from outbox_jobs where kind='BIRTHDAY_PUSH'",Integer.class)).isEqualTo(1);
        mvc.perform(get("/api/notifications").header("Authorization",auth(b))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        pairing.disconnect(a);
        mvc.perform(get("/api/birthdays").header("Authorization",auth(a))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
    }

    @Test void closedSpaceRetentionPurgesOnlyThatCoupleAndPreservesIndependentAccountsAndPersonalReminders() throws Exception {
        film(a);film(c);recipes.create(a,recipeInput("Old shared recipe"),UUID.randomUUID());
        wishes.create(a,new com.lifeorganizer.wishes.WishRequest("Old wish",com.lifeorganizer.wishes.WishCategory.BOOK,null,null,null),UUID.randomUUID());
        moment(a,group(a).id());var foreign=moment(c,group(c).id());
        birthdays.create(a,new com.lifeorganizer.birthdays.BirthdayRequest("Keep my reminder",11,7,"UTC"));
        notes.create(a,new com.lifeorganizer.notes.CoupleNoteService.Input("Old note",com.lifeorganizer.notes.CoupleNoteService.Mode.SEND,null),UUID.randomUUID());
        pairing.disconnect(a);
        assertThat(couples.existsById(first)).isTrue();
        jdbc.update("update couples set closed_at=current_timestamp-interval '31 days' where id=?",first);
        jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp where kind='CLOSED_COUPLE_CLEANUP' and resource_id=?",first);
        runner.runBatch();
        assertThat(couples.existsById(first)).isFalse();assertThat(couples.existsById(second)).isTrue();
        assertThat(users.existsById(a.getId())).isTrue();assertThat(users.existsById(b.getId())).isTrue();
        assertThat(birthdays.list(a)).hasSize(1);assertThat(watch.list(c)).hasSize(1);assertThat(moments.get(c,foreign.id()).id()).isEqualTo(foreign.id());
        mvc.perform(get("/api/privacy/policy")).andExpect(status().isOk()).andExpect(jsonPath("$.closedSpaceRetentionDays").value(30)).andExpect(jsonPath("$.endToEndEncrypted").value(false));
    }

    @Test void independentlyRetainedDeletionMarkersDenyRestoredSessionsAndRequeuePhysicalErasure() throws Exception {
        String oldToken=auth(a);moment(a,group(a).id());
        UUID sid=jwt.extractSessionId(oldToken.substring(7));String raw=sid+"."+tokens.random();
        jdbc.update("update refresh_sessions set token_hash=? where id=?",com.lifeorganizer.identity.SecretTokens.hash(raw),sid);
        jdbc.update("insert into deletion_markers(user_id) values (?)",a.getId());
        assertThatThrownBy(()->identity.refresh(raw)).isInstanceOf(InvalidCredentialsException.class);
        mvc.perform(get("/api/identity/me").header("Authorization",oldToken)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/watchlist").header("Authorization",auth(b))).andExpect(status().isForbidden());
        assertThat(pairing.current(b).status()).isEqualTo("DISCONNECTED");
        restoreGuard.reconcile(a.getId());runner.runBatch();
        assertThat(users.existsById(a.getId())).isFalse();assertThat(users.existsById(b.getId())).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from deletion_markers where user_id=?",Integer.class,a.getId())).isEqualTo(1);
    }

    @Test void storageQuotaCannotBeResetByStartingAnotherCoupleBeforeOldPhotosAreDeleted() throws Exception {
        UUID photo=wishes.upload(a,photo()).id();
        jdbc.update("update wish_photos set size=104857600 where id=?",photo);
        pairing.disconnect(a);a.verifyEmail();users.saveAndFlush(a);pairing.create(a);
        assertThatThrownBy(()->wishes.upload(a,photo())).isInstanceOf(IllegalStateException.class).hasMessageContaining("storage limit");
        var current=group(a);
        assertThatThrownBy(()->moments.upload(a,current.id(),photo())).isInstanceOf(IllegalStateException.class).hasMessageContaining("storage limit");
        assertThat(wishes.upload(c,photo()).id()).isNotNull();
    }

    @Test void anIncorrectConfirmationPasswordDoesNotInvalidateTheExistingSession() throws Exception {
        User user=verifiedAccount("confirmation@example.test");var session=signIn(user);
        mvc.perform(post("/api/identity/reauthenticate").header("Authorization","Bearer "+session.token()).contentType("application/json").content("{\"password\":\"incorrect\"}")).andExpect(status().isForbidden());
        mvc.perform(get("/api/identity/me").header("Authorization","Bearer "+session.token())).andExpect(status().isOk());
    }

    @Test void racingClaimsForTheLastSlotCommitOnlyOneMembership() throws Exception {
        Couple waiting = couples.saveAndFlush(new Couple(Instant.now()));
        insertMembership(waiting.getId(), unpaired.getId(), 1);
        User e = account("E", Role.OWNER), f = account("F", Role.OWNER);
        CountDownLatch start = new CountDownLatch(1);
        try (var executor = Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> results = new ArrayList<>();
            for (User candidate : List.of(e, f)) results.add(executor.submit(() -> {
                start.await();
                try { insertMembership(waiting.getId(), candidate.getId(), 2); return true; }
                catch (DataIntegrityViolationException conflict) { return false; }
            }));
            start.countDown();
            int accepted = 0;
            for (var result : results) if (result.get(10, TimeUnit.SECONDS)) accepted++;
            assertThat(accepted).isEqualTo(1);
        }
        assertThat(jdbc.queryForObject("select count(*) from couple_memberships where couple_id = ? and left_at is null", Integer.class, waiting.getId())).isEqualTo(2);
    }
}
