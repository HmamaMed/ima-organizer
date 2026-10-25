package com.lifeorganizer.config;

import java.sql.*;
import java.time.ZoneId;
import java.util.*;
import java.util.function.ToLongFunction;
import java.util.regex.Pattern;

/** Copies a frozen two-account database; never alters or baselines its source schema. */
public final class PersonalDataImporter {
    public record Settings(String source, String target, String ownerEmail, String recipientEmail,
                           String sharedAuthor, String timeZone) {}
    private record Value(String sql, List<Object> parameters) {
        static Value bind(Object value) { return new Value("?", Collections.singletonList(value)); }
        static Value sql(String sql) { return new Value(sql, List.of()); }
    }
    private static final List<String> TABLES = List.of("users", "couples", "couple_memberships", "notes",
        "memory_groups", "media_assets", "memories", "wish_photos", "wishes", "watch_items", "watch_reviews",
        "recipes", "recipe_ingredients", "recipe_steps", "birthday_reminders", "birthday_deliveries",
        "birthday_notifications", "agios", "library_exercises", "programmes", "programme_days", "day_exercises",
        "workout_logs", "exercise_ticks");
    private final Connection connection;
    private final Settings settings;
    private final ToLongFunction<String> objectSize;
    private final Map<String, Long> counts = new LinkedHashMap<>();

    public PersonalDataImporter(Connection connection, Settings settings, ToLongFunction<String> objectSize) {
        this.connection = connection; this.settings = settings; this.objectSize = objectSize;
    }
    public static String identifier(String name) {
        if (name == null || !name.matches("[a-z_][a-z0-9_]{0,62}"))
            throw new IllegalArgumentException("Use a lowercase SQL schema/role name containing only letters, numbers and underscores");
        return '"' + name + '"';
    }
    private String source(String table) { return identifier(settings.source()) + "." + identifier(table); }
    private String target(String table) { return identifier(settings.target()) + "." + identifier(table); }
    private int update(String sql, Object... values) throws SQLException {
        try (var statement = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.length; i++) statement.setObject(i + 1, values[i]);
            return statement.executeUpdate();
        }
    }
    private long count(String sql) throws SQLException {
        try (var statement = connection.createStatement(); var rows = statement.executeQuery(sql)) {
            rows.next(); return rows.getLong(1);
        }
    }
    private Set<String> columns(String schema, String table) throws SQLException {
        var result = new LinkedHashSet<String>();
        try (var query = connection.prepareStatement("select column_name from information_schema.columns where table_schema=? and table_name=? order by ordinal_position")) {
            query.setString(1, schema); query.setString(2, table);
            try (var rows = query.executeQuery()) { while (rows.next()) result.add(rows.getString(1)); }
        }
        return result;
    }
    /** Called under an advisory transaction lock, before Flyway creates the target. */
    public boolean alreadyImported() throws SQLException {
        if (!columns(settings.target(), "personal_import_runs").isEmpty()) {
            long runs = count("select count(*) from " + target("personal_import_runs"));
            if (runs > 0) {
                try (var statement = connection.prepareStatement("select source_schema from " + target("personal_import_runs")); var rows = statement.executeQuery()) {
                    rows.next();
                    if (!settings.source().equals(rows.getString(1))) throw new IllegalStateException("This target was already imported from a different schema");
                }
                return true;
            }
        }
        return false;
    }
    public void preflight() throws SQLException {
        identifier(settings.source()); identifier(settings.target());
        if (settings.source().equals(settings.target()) || Set.of("pg_catalog", "information_schema").contains(settings.target()))
            throw new IllegalArgumentException("Personal import needs a separate target schema, for example couples_app");
        Pattern email = Pattern.compile("[^\\s@]+@[^\\s@]+\\.[^\\s@]+");
        for (String value : List.of(settings.ownerEmail(), settings.recipientEmail())) {
            if (value.length() > 320 || !email.matcher(value).matches()) throw new IllegalArgumentException("Configure both personal-import email addresses");
        }
        if (settings.ownerEmail().equalsIgnoreCase(settings.recipientEmail())) throw new IllegalArgumentException("The two accounts need different email addresses");
        if (!Set.of("OWNER", "RECIPIENT").contains(settings.sharedAuthor())) throw new IllegalArgumentException("Explicitly choose OWNER or RECIPIENT for imported shared notebook authorship");
        ZoneId.of(settings.timeZone());
        if (columns(settings.source(), "users").isEmpty()) throw new IllegalStateException("Personal source schema has no users table");
        // Stable source snapshot: old writers must be stopped for the entire cutover, including after commit.
        for (String table : TABLES.stream().sorted().toList()) {
            if (!columns(settings.source(), table).isEmpty()) {
                update("lock table " + source(table) + " in share mode");
                try (var query = connection.prepareStatement("select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname=? and c.relname=? and t.tgname='lifeorganizer_cutover_readonly' and t.tgenabled='O' and not t.tgisinternal")) {
                    query.setString(1, settings.source()); query.setString(2, table);
                    try (var rows = query.executeQuery()) {
                        rows.next();
                        if (rows.getInt(1) != 1) throw new IllegalStateException("Freeze the original app tables with the prepared cutover SQL before importing; missing write fence on " + table);
                    }
                }
            }
        }
        if (count("select count(*) from " + source("users")) != 2
            || count("select count(*) from " + source("users") + " where role='OWNER'") != 1
            || count("select count(*) from " + source("users") + " where role='RECIPIENT'") != 1)
            throw new IllegalStateException("Personal import requires exactly one existing OWNER and one existing RECIPIENT; source is untouched");
        if (columns(settings.source(), "users").contains("deletion_requested")
            && count("select count(*) from " + source("users") + " where deletion_requested") != 0)
            throw new IllegalStateException("Source contains an account pending deletion; import cannot reactivate it");
        for (String table : List.of("couples", "couple_memberships", "deletion_markers", "refresh_sessions")) {
            if (!columns(settings.source(), table).isEmpty() && count("select count(*) from " + source(table)) != 0)
                throw new IllegalStateException("Source already contains relationship/session/deletion records; use a reviewed upgrade instead of the two-account importer");
        }
        var targetTables = new ArrayList<String>();
        try (var query = connection.prepareStatement("select tablename from pg_tables where schemaname=? and tablename<>'flyway_schema_history'")) {
            query.setString(1, settings.target());
            try (var rows = query.executeQuery()) { while (rows.next()) targetTables.add(rows.getString(1)); }
        }
        for (String table : targetTables) {
            if (count("select count(*) from " + target(table)) != 0)
                throw new IllegalStateException("Personal import target must be empty: " + table + " contains data; existing target data was not changed");
        }
        if (!columns(settings.source(), "memories").isEmpty()
            && count("select count(*) from " + source("memories") + " where group_id is null or photo_asset_id is null") != 0)
            throw new IllegalStateException("Some old memories have no private R2 asset/group. Import stopped without modifying the source; classify these references before retrying");
    }
    private UUID account(String role) throws SQLException {
        try (var statement = connection.prepareStatement("select id from " + source("users") + " where role=?")) {
            statement.setString(1, role);
            try (var rows = statement.executeQuery()) { rows.next(); return rows.getObject(1, UUID.class); }
        }
    }
    private Map<String, Value> scope(UUID couple, String authorColumn, UUID author) {
        var result = new HashMap<String, Value>();
        result.put("couple_id", Value.bind(couple)); result.put(authorColumn, Value.bind(author));
        result.put("client_request_id", Value.sql("s.id")); return result;
    }
    private void copy(String table, Map<String, Value> overrides) throws SQLException {
        Set<String> existing = columns(settings.source(), table);
        if (existing.isEmpty()) { counts.put(table, 0L); return; }
        var names = new ArrayList<String>(); var expressions = new ArrayList<String>(); var parameters = new ArrayList<Object>();
        for (String column : columns(settings.target(), table)) {
            Value value = overrides.get(column);
            if (value != null) { names.add(identifier(column)); expressions.add(value.sql()); parameters.addAll(value.parameters()); }
            else if (existing.contains(column)) { names.add(identifier(column)); expressions.add("s." + identifier(column)); }
        }
        long expected = count("select count(*) from " + source(table));
        long copied = update("insert into " + target(table) + " (" + String.join(",", names) + ") select " + String.join(",", expressions) + " from " + source(table) + " s", parameters.toArray());
        if (copied != expected) throw new IllegalStateException("Row count verification failed for " + table);
        // Verify original values as well as counts; transformed columns remain in the untouched source.
        var preserved = existing.stream().filter(c -> names.contains(identifier(c)) && !overrides.containsKey(c)).map(PersonalDataImporter::identifier).toList();
        if (!preserved.isEmpty() && count("select count(*) from (select " + String.join(",", preserved) + " from " + source(table) + " except select " + String.join(",", preserved) + " from " + target(table) + ") differences") != 0)
            throw new IllegalStateException("Content verification failed for " + table);
        counts.put(table, copied);
    }
    private void enqueue(String kind, UUID id, UUID couple, String key, Timestamp due) throws SQLException {
        update("insert into " + target("outbox_jobs") + " (id,kind,resource_id,couple_id,deduplication_key,next_attempt_at) values (?,?,?,?,?,?)", UUID.randomUUID(), kind, id, couple, key, due);
    }
    public Map<String, Long> copyAll() throws SQLException {
        UUID owner = account("OWNER"), recipient = account("RECIPIENT"), couple = UUID.randomUUID();
        UUID shared = settings.sharedAuthor().equals("OWNER") ? owner : recipient;
        copy("users", Map.of("email", new Value("case when s.role='OWNER' then ? else ? end", List.of(settings.ownerEmail().toLowerCase(Locale.ROOT), settings.recipientEmail().toLowerCase(Locale.ROOT))),
            "email_verified", Value.sql("false"), "deletion_requested", Value.sql("false"), "fcm_token", Value.sql("null"),
            "locale", Value.sql("'fr'"), "time_zone", Value.bind(settings.timeZone())));
        update("insert into " + target("couples") + " (id,status,created_at) values (?,'ACTIVE',current_timestamp)", couple);
        for (var member : List.of(Map.entry(owner, 1), Map.entry(recipient, 2)))
            update("insert into " + target("couple_memberships") + " (id,couple_id,user_id,slot,joined_at) values (?,?,?,?,current_timestamp)", UUID.randomUUID(), couple, member.getKey(), member.getValue());
        var notes = scope(couple, "sender_id", owner);
        notes.put("recipient_id", Value.bind(recipient)); notes.put("delivery_version", Value.sql("1"));
        notes.put("sent_at", Value.sql("case when s.status='SENT' then coalesce(s.sent_at,s.created_at) else null end"));
        copy("notes", notes);
        var groups = scope(couple, "creator_id", owner);
        groups.put("expires_at", Value.sql("coalesce(s.expires_at,s.created_at + interval '72 hours')"));
        groups.put("deleted_at", Value.sql("case when s.expires_at is null then coalesce(s.deleted_at,current_timestamp) else s.deleted_at end"));
        copy("memory_groups", groups);
        copy("media_assets", Map.of("couple_id", Value.bind(couple), "owner_id", Value.bind(owner), "upload_state", Value.sql("'READY'")));
        copy("memories", scope(couple, "creator_id", owner));
        copy("wish_photos", Map.of("couple_id", Value.bind(couple), "size", Value.sql("0"), "upload_state", Value.sql("'READY'")));
        copy("wishes", scope(couple, "owner_id", recipient));
        // These modules were shared without authorship. The operator explicitly chooses an attribution.
        copy("watch_items", Map.of("couple_id", Value.bind(couple), "created_by_id", columns(settings.source(), "watch_items").contains("created_by_id")
            ? new Value("coalesce(s.created_by_id,?)", List.of(shared)) : Value.bind(shared)));
        copy("watch_reviews", Map.of("couple_id", Value.bind(couple)));
        copy("recipes", scope(couple, "creator_id", shared));
        for (String table : List.of("recipe_ingredients", "recipe_steps")) copy(table, Map.of("couple_id", Value.bind(couple)));
        for (String table : List.of("birthday_reminders", "birthday_deliveries", "birthday_notifications", "agios", "library_exercises", "programmes", "programme_days", "day_exercises", "workout_logs", "exercise_ticks")) copy(table, Map.of());
        registerMedia(couple);
        try (var query = connection.createStatement(); var rows = query.executeQuery("select id,scheduled_for from " + target("notes") + " where status='SCHEDULED'")) {
            while (rows.next()) { UUID id = rows.getObject(1, UUID.class); enqueue("NOTE_DELIVERY", id, couple, "note-delivery:" + id + ":1", rows.getTimestamp(2)); }
        }
        try (var query = connection.createStatement(); var rows = query.executeQuery("select id,case when deleted_at is not null then current_timestamp else expires_at end from " + target("memory_groups"))) {
            while (rows.next()) { UUID id = rows.getObject(1, UUID.class); enqueue("MEMORY_CLEANUP", id, couple, "memory-cleanup:" + id, rows.getTimestamp(2)); }
        }
        try (var query = connection.createStatement(); var rows = query.executeQuery("select id,created_at+interval '24 hours' from " + target("media_assets") + " where not attached")) {
            while (rows.next()) { UUID id = rows.getObject(1, UUID.class); enqueue("ASSET_CLEANUP", id, couple, "asset-orphan:" + id, rows.getTimestamp(2)); }
        }
        try (var query = connection.createStatement(); var rows = query.executeQuery("select id,delete_after from " + target("wish_photos") + " where delete_after is not null")) {
            while (rows.next()) { UUID id = rows.getObject(1, UUID.class); enqueue("WISH_PHOTO_CLEANUP", id, couple, "wish-photo-orphan:" + id, rows.getTimestamp(2)); }
        }
        String json = "{" + String.join(",", counts.entrySet().stream().map(e -> "\"" + e.getKey() + "\":" + e.getValue()).toList()) + "}";
        update("insert into " + target("personal_import_runs") + " (source_schema,couple_id,row_counts) values (?,?,?::jsonb)", settings.source(), couple, json);
        return Map.copyOf(counts);
    }
    private void registerMedia(UUID couple) throws SQLException {
        try (var query = connection.createStatement(); var rows = query.executeQuery("select id,object_key,group_id from " + target("media_assets"))) {
            while (rows.next()) {
                UUID id = rows.getObject(1, UUID.class), group = rows.getObject(3, UUID.class); String key = rows.getString(2);
                if (!key.matches("memories/" + group + "/[0-9a-f-]{36}\\.(jpg|png|webp|webm|m4a|aac|ogg|mp3|wav|3gp)")) throw new IllegalStateException("Unexpected legacy memory object key; import stopped");
                update("insert into " + target("imported_media_assets") + " (id,object_key) values (?,?)", id, key);
            }
        }
        try (var query = connection.createStatement(); var rows = query.executeQuery("select id,object_key from " + target("wish_photos"))) {
            while (rows.next()) {
                UUID id = rows.getObject(1, UUID.class); String key = rows.getString(2);
                if (!key.matches("wishes/[0-9a-f-]{36}\\.(jpg|png|webp)")) throw new IllegalStateException("Unexpected legacy wish object key; import stopped");
                long size = objectSize.applyAsLong(key);
                if (size <= 0) throw new IllegalStateException("Could not verify the existing wish photo size in R2");
                update("update " + target("wish_photos") + " set size=? where id=? and couple_id=?", size, id, couple);
                update("insert into " + target("imported_wish_photos") + " (id,object_key) values (?,?)", id, key);
            }
        }
    }
}
