package com.lifeorganizer.config;

import org.springframework.boot.flyway.autoconfigure.FlywayMigrationStrategy;
import org.springframework.context.annotation.*;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import java.sql.*;
import java.util.*;

@Configuration
@Profile("couples")
public class DatabaseMigrationConfiguration {
    @Bean
    FlywayMigrationStrategy migrateDatabase(Environment env) {
        return flyway -> {
            String target = env.getProperty("spring.flyway.default-schema", "public");
            try (var connection = flyway.getConfiguration().getDataSource().getConnection()) {
                connection.setAutoCommit(false);
                try {
                    try (var lock = connection.prepareStatement("select pg_advisory_xact_lock(hashtext('lifeorganizer-upgrade'),hashtext(?))")) {
                        lock.setString(1, target); lock.execute();
                    }
                    try (var statement = connection.createStatement()) { statement.execute("set local lock_timeout='15s'"); }
                    flyway.migrate();
                    if (env.acceptsProfiles(Profiles.of("couples-production")))
                        grantRuntimeAccess(connection, target, env.getRequiredProperty("spring.datasource.username"));
                    connection.commit();
                } catch (Exception failure) {
                    connection.rollback();
                    throw new IllegalStateException("Could not apply database migrations and runtime permissions. " + failure.getMessage(), failure);
                }
            } catch (SQLException failure) { throw new IllegalStateException("Could not prepare the application database", failure); }
        };
    }

    /** Migration credentials own DDL/provenance; runtime can only read provenance and change app data. */
    static void grantRuntimeAccess(Connection connection, String schema, String runtime) throws SQLException {
        String role = identifier(runtime), quotedSchema = identifier(schema);
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
                statement.execute("grant " + access + " on " + quotedSchema + "." + identifier(table) + " to " + role);
            }
        }
    }

    private static String identifier(String name) {
        if (name == null || !name.matches("[a-z_][a-z0-9_]{0,62}"))
            throw new IllegalArgumentException("Use a lowercase SQL schema/role name containing only letters, numbers and underscores");
        return '"' + name + '"';
    }
}
