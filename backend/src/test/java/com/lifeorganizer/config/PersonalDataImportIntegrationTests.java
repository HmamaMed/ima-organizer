package com.lifeorganizer.config;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.identity.IdentityService;
import com.lifeorganizer.media.R2Storage;
import com.lifeorganizer.memories.CoupleMediaCleanup;
import com.lifeorganizer.notes.CoupleNoteService;
import com.lifeorganizer.wishes.CoupleWishService;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.sql.*;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {"app.jwt.secret=import-test-jwt-secret-longer-than-32-characters",
    "app.identity.token-secret=import-test-action-secret-longer-than-32-characters", "app.jobs.enabled=false", "app.couples-firebase-path="})
@ActiveProfiles("couples")
@AutoConfigureMockMvc
@Testcontainers
class PersonalDataImportIntegrationTests {
    @Container static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @org.springframework.test.context.bean.override.mockito.MockitoBean R2Storage storage;
    @Autowired JdbcTemplate jdbc;
    @Autowired Flyway flyway;
    @Autowired IdentityService identity;
    @Autowired UserRepository users;
    @Autowired CoupleNoteService notes;
    @Autowired CoupleWishService wishes;
    @Autowired CoupleMediaCleanup cleanup;
    @Autowired MockMvc mvc;
    String source;
    final UUID owner = UUID.randomUUID(), recipient = UUID.randomUUID(), group = UUID.randomUUID(), asset = UUID.randomUUID(),
        moment = UUID.randomUUID(), photo = UUID.randomUUID(), wish = UUID.randomUUID(), note = UUID.randomUUID(), scheduled = UUID.randomUUID(),
        film = UUID.randomUUID(), recipe = UUID.randomUUID(), reminder = UUID.randomUUID();
    String assetKey, photoKey, originalHash;

    @BeforeEach void fixture() {
        reset(storage);
        when(storage.objectSize(anyString())).thenReturn(321L);
        when(storage.readUrl(anyString(),any(),any())).thenReturn("https://private.test/signed");
        jdbc.execute("truncate table personal_import_runs, users, couples, programmes, library_exercises, workout_logs, exercise_ticks, outbox_jobs, deletion_markers cascade");
        source = "legacy_" + UUID.randomUUID().toString().replace("-", "");
        var old = Flyway.configure().dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
            .locations("classpath:db/couples").schemas(source).defaultSchema(source).target("1").load();
        old.migrate();
        jdbc.execute("drop table " + source + ".flyway_schema_history");
        originalHash = new BCryptPasswordEncoder().encode("existing-password");
        jdbc.update("insert into " + source + ".users(id,name,role,password_hash,fcm_token) values (?, 'Original owner','OWNER',?,'old-device'), (?, 'Original recipient','RECIPIENT',?,'other-device')", owner, originalHash, recipient, originalHash);
        // The mistakenly deployed legacy/Hibernate app may already have added nullable identity fields.
        jdbc.execute("alter table " + source + ".users add column email varchar(320), add column email_verified boolean default false, add column deletion_requested boolean default false, add column locale varchar(20), add column time_zone varchar(100)");
        jdbc.update("insert into " + source + ".notes(id,content,status,created_at,sent_at,notification_status) values (?,'A preserved sent note','SENT',current_timestamp,current_timestamp,'SENT')", note);
        jdbc.update("insert into " + source + ".notes(id,content,status,created_at,scheduled_for,notification_status) values (?,'Still scheduled','SCHEDULED',current_timestamp,current_timestamp+interval '1 day','PENDING')", scheduled);
        jdbc.update("insert into " + source + ".memory_groups(id,name,created_at,expires_at) values (?,'Our old group',current_timestamp-interval '1 hour',current_timestamp+interval '71 hours')", group);
        assetKey = "memories/" + group + "/" + UUID.randomUUID() + ".webp";
        jdbc.update("insert into " + source + ".media_assets(id,group_id,object_key,content_type,size,attached,created_at) values (?,?,?,'image/webp',123,true,current_timestamp)", asset, group, assetKey);
        jdbc.update("insert into " + source + ".memories(id,group_id,photo_asset_id,photo_url,caption,memory_date,created_at) values (?,?,?,?,'Preserved photo',current_date,current_timestamp)", moment, group, asset, "r2://" + assetKey);
        photoKey = "wishes/" + UUID.randomUUID() + ".jpg";
        jdbc.update("insert into " + source + ".wish_photos(id,uploader_id,object_key,ready) values (?,?,?,true)", photo, recipient, photoKey);
        jdbc.update("insert into " + source + ".wishes(id,title,category,photo_id,created_at) values (?,'A preserved wish','OBJECT',?,current_timestamp)", wish, photo);
        jdbc.update("insert into " + source + ".watch_items(id,title,kind,status,created_at) values (?,'A preserved film','FILM','WATCHED',current_timestamp)", film);
        for (UUID user : List.of(owner, recipient)) jdbc.update("insert into " + source + ".watch_reviews(id,item_id,user_id,rating,comment,updated_at) values (?,?,?,5,'A preserved review',current_timestamp)", UUID.randomUUID(), film, user);
        jdbc.update("insert into " + source + ".recipes(id,title,status,servings,created_at) values (?,'A preserved recipe','FAVORITE',2,current_timestamp)", recipe);
        jdbc.update("insert into " + source + ".recipe_ingredients(recipe_id,ingredient_position,ingredient_name,amount) values (?,0,'Rice','100 g')", recipe);
        jdbc.update("insert into " + source + ".recipe_steps(recipe_id,step_position,instruction) values (?,0,'Cook it')", recipe);
        jdbc.update("insert into " + source + ".birthday_reminders(id,user_id,label,birthday_day,birthday_month,time_zone,created_at) values (?,?,'Birthday',1,1,'Africa/Casablanca',current_timestamp)", reminder, recipient);
        jdbc.update("insert into " + source + ".birthday_deliveries(id,reminder_id,birthday_date,days_before,sent_at) values (?,?,'2026-01-01',1,current_timestamp)", UUID.randomUUID(), reminder);
        jdbc.update("insert into " + source + ".birthday_notifications(id,reminder_id,user_id,birthday_date,days_before,title,body,dismissed,created_at) values (?,?,?,'2026-01-01',1,'Reminder','Old inbox entry',false,current_timestamp)", UUID.randomUUID(), reminder, recipient);
        jdbc.update("insert into " + source + ".agios(id,user_id,amount,credit_date,created_at) values (?,?,12.50,current_date,current_timestamp)", UUID.randomUUID(), owner);
        UUID programme = UUID.randomUUID(), day = UUID.randomUUID(), exercise = UUID.randomUUID(), assignment = UUID.randomUUID();
        jdbc.update("insert into " + source + ".programmes(id,name,active,created_at) values (?,'Original programme',true,current_timestamp)", programme);
        jdbc.update("insert into " + source + ".programme_days(id,programme_id,label,sort_order) values (?,?,'Day 1',0)", day, programme);
        jdbc.update("insert into " + source + ".library_exercises(id,name,instructions,muscle_group,created_at) values (?,'Squat','Carefully','LEGS',current_timestamp)", exercise);
        jdbc.update("insert into " + source + ".day_exercises(id,library_exercise_id,programme_day_id,sets,reps,sort_order) values (?,?,?,3,'10',0)", assignment, exercise, day);
        jdbc.update("insert into " + source + ".workout_logs(id,user_id,workout_day_id,completed_at) values (?,?,?,current_timestamp)", UUID.randomUUID(), recipient, day);
        jdbc.update("insert into " + source + ".exercise_ticks(id,user_id,day_exercise_id,tick_date,completed_at) values (?,?,?,current_date,current_timestamp)", UUID.randomUUID(), recipient, assignment);
    }
    @AfterEach void cleanSource() { jdbc.execute("drop schema if exists " + source + " cascade"); }
    MockEnvironment environment() {
        return new MockEnvironment().withProperty("app.personal-import.enabled","true")
            .withProperty("app.personal-import.source-schema", source).withProperty("spring.flyway.default-schema", "public")
            .withProperty("app.personal-import.owner-email", "owner@example.test")
            .withProperty("app.personal-import.recipient-email", "recipient@example.test")
            .withProperty("app.personal-import.shared-author", "OWNER");
    }
    void freezeSource() {
        try { jdbc.execute(java.nio.file.Files.readString(java.nio.file.Path.of("scripts/freeze-personal.sql")).replace("public",source)); }
        catch (java.io.IOException failure) { throw new java.io.UncheckedIOException(failure); }
    }
    void runImport() { freezeSource(); new DatabaseUpgradeConfiguration().migrateDatabase(environment(), storage).migrate(flyway); }
    Map<String,String> fingerprints() {
        Map<String,String> hashes = new TreeMap<>();
        for (String table : jdbc.queryForList("select tablename from pg_tables where schemaname=?",String.class,source))
            hashes.put(table,jdbc.queryForObject("select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from " + source + "." + table + " t",String.class));
        return hashes;
    }
    @Test void preservesSourceAndExistingPasswordsAndMakesImportedFeaturesAccessible() throws Exception {
        var before = fingerprints();
        runImport();
        assertThat(fingerprints()).isEqualTo(before);
        assertThat(jdbc.queryForObject("select password_hash from users where id=?",String.class,owner)).isEqualTo(originalHash);
        assertThat(jdbc.queryForObject("select count(*) from personal_import_runs",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select (row_counts->>'exercise_ticks')::int from personal_import_runs",Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select expires_at from memory_groups where id=?",Instant.class,group)).isEqualTo(jdbc.queryForObject("select expires_at from " + source + ".memory_groups where id=?",Instant.class,group));
        assertThat(jdbc.queryForObject("select size from wish_photos where id=?",Long.class,photo)).isEqualTo(321);
        assertThat(jdbc.queryForList("select fcm_token from users",String.class)).containsOnlyNulls();
        var signedIn = identity.login(new IdentityService.Login("owner@example.test","existing-password","Test"));
        assertThat(signedIn.user().userId()).isEqualTo(owner);
        assertThat(signedIn.user().emailVerified()).isFalse();
        String auth = "Bearer " + signedIn.token();
        mvc.perform(get("/api/identity/me").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$.userId").value(owner.toString()));
        mvc.perform(get("/api/couples/current").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ACTIVE"));
        mvc.perform(get("/api/notes?view=sent").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$[0].content").value("A preserved sent note"));
        mvc.perform(get("/api/watchlist").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$[0].reviews.length()").value(2));
        mvc.perform(get("/api/recipes").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$[0].ingredients[0].name").value("Rice"));
        mvc.perform(get("/api/memories").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(moment.toString()));
        mvc.perform(get("/api/wishes").header("Authorization",auth)).andExpect(status().isOk()).andExpect(jsonPath("$[0].id").value(wish.toString()));
        assertThat(jdbc.queryForObject("select count(*) from outbox_jobs where kind='NOTE_DELIVERY'",Integer.class)).isEqualTo(1);
        verify(storage).objectSize(photoKey);
        verify(storage,never()).upload(anyString(),any(),anyLong(),anyString());
        verify(storage,never()).deleteObject(anyString());
    }
    @Test void repeatedStartupDoesNotReimportOrOverwriteChangesEvenAfterAccountErasure() {
        runImport();
        jdbc.update("update notes set content='Edited after cutover' where id=?",note);
        runImport();
        assertThat(jdbc.queryForObject("select content from notes where id=?",String.class,note)).isEqualTo("Edited after cutover");
        jdbc.execute("truncate table users cascade");
        runImport();
        assertThat(users.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from personal_import_runs",Integer.class)).isEqualTo(1);
    }
    @Test void anInvalidMediaReferenceRollsBackEveryImportedRowAndKeepsSourceUntouched() {
        jdbc.update("update " + source + ".media_assets set object_key='unrelated/another-users-file' where id=?",asset);
        var before = fingerprints();
        assertThatThrownBy(this::runImport).hasMessageContaining("Unexpected legacy memory object key");
        assertThat(users.count()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from personal_import_runs",Integer.class)).isZero();
        assertThat(fingerprints()).isEqualTo(before);
    }
    @Test void refusesAmbiguousAccounts() {
        jdbc.update("insert into " + source + ".users(id,name,role,password_hash) values (?,'Unexpected third account','OWNER','hash')",UUID.randomUUID());
        assertThatThrownBy(this::runImport).hasMessageContaining("exactly one existing OWNER");
        assertThat(users.count()).isZero();
    }
    @Test void refusesExistingTargetData() {
        jdbc.update("insert into users(id,name,role,password_hash) values (?,'Existing target user','MEMBER','hash')",UUID.randomUUID());
        assertThatThrownBy(this::runImport).hasMessageContaining("target must be empty");
        assertThat(users.count()).isEqualTo(1);
    }
    @Test void neverReactivatesAnAccountAlreadyPendingDeletion() {
        jdbc.update("update " + source + ".users set deletion_requested=true where id=?",owner);
        assertThatThrownBy(this::runImport).hasMessageContaining("cannot reactivate");
        assertThat(users.count()).isZero();
    }
    @Test void refusesAnUnfrozenSourceAndTheFenceRejectsLateOldAppWrites() {
        assertThatThrownBy(() -> new DatabaseUpgradeConfiguration().migrateDatabase(environment(),storage).migrate(flyway)).hasMessageContaining("missing write fence");
        assertThat(users.count()).isZero();
        runImport();
        assertThatThrownBy(() -> jdbc.update("update " + source + ".notes set content='Late old app write' where id=?",note)).hasMessageContaining("read-only during upgrade");
        assertThat(jdbc.queryForObject("select content from notes where id=?",String.class,note)).isEqualTo("A preserved sent note");
    }
    @Test void importedMediaCanBeDeletedOnlyWithItsExactMigrationProvenance() {
        runImport();
        UUID scope = jdbc.queryForObject("select id from couples",UUID.class);
        jdbc.update("update memory_groups set deleted_at=current_timestamp where id=?",group);
        cleanup.group(group,scope);
        verify(storage).deleteObject(assetKey);
        assertThat(jdbc.queryForObject("select count(*) from imported_media_assets",Integer.class)).isZero();
        wishes.delete(users.findById(recipient).orElseThrow(),wish);
        wishes.cleanup(photo,scope);
        verify(storage).deleteObject(photoKey);
        assertThat(jdbc.queryForObject("select count(*) from imported_wish_photos",Integer.class)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from " + source + ".memories",Integer.class)).isEqualTo(1);
    }
    @Test void runtimeRoleCanUseAppTablesButCannotAlterMigrationProvenance() throws Exception {
        runImport();
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())) {
            jdbc.execute("create role import_runtime_test");
            DatabaseUpgradeConfiguration.grantRuntimeAccess(connection,"public","import_runtime_test");
            assertThat(jdbc.queryForObject("select has_table_privilege('import_runtime_test','public.notes','UPDATE')",Boolean.class)).isTrue();
            assertThat(jdbc.queryForObject("select has_table_privilege('import_runtime_test','public.imported_media_assets','SELECT')",Boolean.class)).isTrue();
            assertThat(jdbc.queryForObject("select has_table_privilege('import_runtime_test','public.imported_media_assets','INSERT')",Boolean.class)).isFalse();
            assertThat(jdbc.queryForObject("select has_table_privilege('import_runtime_test','public.flyway_schema_history','UPDATE')",Boolean.class)).isFalse();
            jdbc.execute("drop owned by import_runtime_test");
            jdbc.execute("drop role import_runtime_test");
        }
    }
    @Test void publicAccountRoutesDoNotRequireAnExistingSession() throws Exception {
        mvc.perform(get("/api/privacy/policy")).andExpect(status().isOk());
        mvc.perform(post("/api/identity/login").contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(get("/verify")).andExpect(status().isOk()).andExpect(forwardedUrl("/index.html"));
        mvc.perform(get("/api/notes")).andExpect(status().isUnauthorized());
    }
}
