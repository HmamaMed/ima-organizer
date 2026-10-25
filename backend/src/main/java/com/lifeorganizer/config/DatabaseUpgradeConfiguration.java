package com.lifeorganizer.config;

import com.lifeorganizer.media.R2Storage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import java.sql.*;
import java.util.*;

@Configuration
@Profile("couples")
public class DatabaseUpgradeConfiguration {
    private static final Logger log = LoggerFactory.getLogger(DatabaseUpgradeConfiguration.class);

    @Bean
    FlywayMigrationStrategy migrateDatabase(Environment env, R2Storage storage) {
        return flyway -> {
            boolean importing = env.getProperty("app.personal-import.enabled", Boolean.class, false);
            String target = env.getProperty("spring.flyway.default-schema", "public");
            String source = env.getProperty("app.personal-import.source-schema", "public");
            var settings = new PersonalDataImporter.Settings(source, target,
                env.getProperty("app.personal-import.owner-email", "").trim(),
                env.getProperty("app.personal-import.recipient-email", "").trim(),
                env.getProperty("app.personal-import.shared-author", ""),
                env.getProperty("app.personal-import.time-zone", "Africa/Casablanca"));
            try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
                connection.setAutoCommit(false);
                try {
                    try (var lock = connection.prepareStatement("select pg_advisory_xact_lock(hashtext('lifeorganizer-upgrade'),hashtext(?))")) {
                        lock.setString(1, target); lock.execute();
                    }
                    try (var statement = connection.createStatement()) { statement.execute("set local lock_timeout='15s'"); }
                    var importer = new PersonalDataImporter(connection, settings, storage::objectSize);
                    boolean done = importing && importer.alreadyImported();
                    if (importing && !done) importer.preflight();
                    flyway.migrate();
                    if (importing && !done) {
                        var counts = importer.copyAll();
                        log.info("Personal import verified into schema {}: {}. Source schema {} was not modified.", target, counts, source);
                    } else if (done) log.info("Personal import already completed; no source data was copied again.");
                    if (env.acceptsProfiles(Profiles.of("couples-production")))
                        grantRuntimeAccess(connection, target, env.getRequiredProperty("spring.datasource.username"));
                    connection.commit();
                } catch (Exception failure) {
                    connection.rollback();
                    throw new IllegalStateException("Database upgrade stopped; imported rows were rolled back and the original schema was not modified. " + failure.getMessage(), failure);
                }
            } catch (SQLException failure) { throw new IllegalStateException("Could not prepare the application database", failure); }
        };
    }

    /** Migration credentials own DDL/provenance; runtime can only read provenance and change app data. */
    static void grantRuntimeAccess(Connection connection, String schema, String runtime) throws SQLException {
        String role = PersonalDataImporter.identifier(runtime), quotedSchema = PersonalDataImporter.identifier(schema);
        var tables = new ArrayList<String>();
        try (var query = connection.prepareStatement("select tablename from pg_tables where schemaname=?")) {
            query.setString(1, schema);
            try (var rows = query.executeQuery()) { while (rows.next()) tables.add(rows.getString(1)); }
        }
        try (var statement = connection.createStatement()) {
            statement.execute("grant usage on schema " + quotedSchema + " to " + role);
            for (String table : tables) {
                if (table.equals("flyway_schema_history")) continue;
                String access = Set.of("personal_import_runs", "imported_media_assets", "imported_wish_photos").contains(table) ? "select" : "select,insert,update,delete";
                statement.execute("grant " + access + " on " + quotedSchema + "." + PersonalDataImporter.identifier(table) + " to " + role);
            }
        }
    }
}
