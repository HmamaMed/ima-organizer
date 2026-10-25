package com.lifeorganizer.config;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.media.R2Storage;
import com.lifeorganizer.memories.CoupleMediaCleanup;
import com.lifeorganizer.wishes.CoupleWishService;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.*;
import org.testcontainers.postgresql.PostgreSQLContainer;
import java.sql.DriverManager;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Ongoing runtime checks retained after removing the completed one-time importer. */
@SpringBootTest(properties = {"app.jwt.secret=database-test-jwt-secret-longer-than-32-characters",
    "app.identity.token-secret=database-test-action-secret-longer-than-32-characters", "app.jobs.enabled=false", "app.couples-firebase-path="})
@ActiveProfiles("couples")
@AutoConfigureMockMvc
@Testcontainers
class DatabaseMigrationIntegrationTests {
    @Container static final PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
    }
    @org.springframework.test.context.bean.override.mockito.MockitoBean R2Storage storage;
    @Autowired JdbcTemplate jdbc;
    @Autowired UserRepository users;
    @Autowired CoupleWishService wishes;
    @Autowired CoupleMediaCleanup cleanup;
    @Autowired MockMvc mvc;

    @BeforeEach void resetFixtures() {
        reset(storage);
        jdbc.execute("truncate table users,couples,outbox_jobs,deletion_markers cascade");
    }

    @Test void importedMediaCanStillBeDeletedWithItsExactProvenance() {
        UUID owner = users.saveAndFlush(new User(Role.OWNER, "Owner", "unused-test-hash")).getId();
        UUID scope = UUID.randomUUID(), group = UUID.randomUUID(), asset = UUID.randomUUID(), photo = UUID.randomUUID();
        jdbc.update("insert into couples(id,status,created_at) values (?,'WAITING',current_timestamp)", scope);
        jdbc.update("insert into couple_memberships(id,couple_id,user_id,slot,joined_at) values (?,?,?,1,current_timestamp)", UUID.randomUUID(), scope, owner);
        jdbc.update("insert into memory_groups(id,name,created_at,expires_at,deleted_at,couple_id,creator_id,client_request_id) values (?,'Existing group',current_timestamp,current_timestamp+interval '1 day',current_timestamp,?,?,?)", group, scope, owner, group);
        String assetKey = "memories/" + group + "/" + asset + ".webp";
        jdbc.update("insert into media_assets(id,group_id,object_key,content_type,size,attached,created_at,couple_id,owner_id) values (?,?,?,'image/webp',123,false,current_timestamp,?,?)", asset, group, assetKey, scope, owner);
        jdbc.update("insert into imported_media_assets(id,object_key) values (?,?)", asset, assetKey);
        String photoKey = "wishes/" + photo + ".jpg";
        jdbc.update("insert into wish_photos(id,uploader_id,object_key,ready,delete_after,couple_id,size,upload_state) values (?,?,?,true,current_timestamp,?,321,'DELETING')", photo, owner, photoKey, scope);
        jdbc.update("insert into imported_wish_photos(id,object_key) values (?,?)", photo, photoKey);

        cleanup.group(group,scope);
        verify(storage).deleteObject(assetKey);
        assertThat(jdbc.queryForObject("select count(*) from imported_media_assets",Integer.class)).isZero();
        wishes.cleanup(photo,scope);
        verify(storage).deleteObject(photoKey);
        assertThat(jdbc.queryForObject("select count(*) from imported_wish_photos",Integer.class)).isZero();
    }

    @Test void runtimeRoleCanUseAppTablesButCannotAlterMigrationProvenance() throws Exception {
        try (var connection = DriverManager.getConnection(postgres.getJdbcUrl(),postgres.getUsername(),postgres.getPassword())) {
            jdbc.execute("create role app_runtime_test");
            try {
                DatabaseMigrationConfiguration.grantRuntimeAccess(connection,"public","app_runtime_test");
                assertThat(jdbc.queryForObject("select has_table_privilege('app_runtime_test','public.notes','UPDATE')",Boolean.class)).isTrue();
                assertThat(jdbc.queryForObject("select has_table_privilege('app_runtime_test','public.imported_media_assets','SELECT')",Boolean.class)).isTrue();
                assertThat(jdbc.queryForObject("select has_table_privilege('app_runtime_test','public.imported_media_assets','INSERT')",Boolean.class)).isFalse();
                assertThat(jdbc.queryForObject("select has_table_privilege('app_runtime_test','public.flyway_schema_history','UPDATE')",Boolean.class)).isFalse();
            } finally {
                jdbc.execute("drop owned by app_runtime_test");
                jdbc.execute("drop role app_runtime_test");
            }
        }
    }

    @Test void publicAccountRoutesDoNotRequireAnExistingSession() throws Exception {
        mvc.perform(get("/api/privacy/policy")).andExpect(status().isOk());
        mvc.perform(post("/api/identity/login").contentType("application/json").content("{}")).andExpect(status().isBadRequest());
        mvc.perform(get("/verify")).andExpect(status().isOk()).andExpect(forwardedUrl("/index.html"));
        mvc.perform(get("/api/notes")).andExpect(status().isUnauthorized());
    }
}
