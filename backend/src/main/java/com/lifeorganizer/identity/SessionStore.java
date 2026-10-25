package com.lifeorganizer.identity;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.*;

@Repository
@Profile("couples")
public class SessionStore {
    private final JdbcTemplate jdbc;
    public SessionStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Session(UUID id, UUID userId, String hash, Instant authenticatedAt, Instant expiresAt, Instant revokedAt) {}
    public Optional<Session> lock(UUID id) {
        return jdbc.query("select * from refresh_sessions where id = ? for update", (r, n) -> new Session(
                r.getObject("id", UUID.class), r.getObject("user_id", UUID.class), r.getString("token_hash"),
                r.getTimestamp("authenticated_at").toInstant(), r.getTimestamp("expires_at").toInstant(),
                r.getTimestamp("revoked_at") == null ? null : r.getTimestamp("revoked_at").toInstant()), id).stream().findFirst();
    }
    public boolean active(UUID id, UUID user) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from refresh_sessions where id = ? and user_id = ? and revoked_at is null and expires_at > current_timestamp and not exists(select 1 from deletion_markers where user_id = ?))", Boolean.class, id, user, user));
    }
    public boolean allowedAccount(UUID user) {
        return Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from users u where u.id=? and not u.deletion_requested and not exists(select 1 from deletion_markers d where d.user_id=u.id))",Boolean.class,user));
    }
    public void requireRecent(UUID session, UUID user) {
        boolean recent = Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from refresh_sessions where id = ? and user_id = ? and revoked_at is null and expires_at > current_timestamp and authenticated_at > current_timestamp - interval '10 minutes')", Boolean.class, session, user));
        if (!recent) throw new org.springframework.security.access.AccessDeniedException("Confirm your password before this action");
    }
    public void revokeAll(UUID user) {
        jdbc.update("update refresh_sessions set revoked_at = current_timestamp where user_id = ? and revoked_at is null", user);
        jdbc.update("update device_registrations set revoked_at = current_timestamp where user_id = ? and revoked_at is null", user);
    }
    public void revoke(UUID id, UUID user) {
        jdbc.update("update refresh_sessions set revoked_at = current_timestamp where id = ? and user_id = ?", id, user);
        jdbc.update("update device_registrations set revoked_at = current_timestamp where session_id = ? and user_id = ?", id, user);
    }
}
