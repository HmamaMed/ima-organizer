package com.lifeorganizer.identity;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.jobs.JobStore;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
@Profile("couples")
public class IdentityService {
    private final UserRepository users;
    private final PasswordEncoder passwords;
    private final JwtService jwt;
    private final SessionStore sessions;
    private final SecretTokens tokens;
    private final JdbcTemplate jdbc;
    private final JobStore jobs;
    private final boolean registrationEnabled;
    private final AccountAccessPolicy access;

    public IdentityService(UserRepository users, PasswordEncoder passwords, JwtService jwt, SessionStore sessions,
                           SecretTokens tokens, JdbcTemplate jdbc, JobStore jobs,
                           @Value("${app.identity.registration-enabled:false}") boolean registrationEnabled, AccountAccessPolicy access) {
        this.users = users; this.passwords = passwords; this.jwt = jwt; this.sessions = sessions;
        this.tokens = tokens; this.jdbc = jdbc; this.jobs = jobs; this.registrationEnabled = registrationEnabled;
        this.access = access;
    }
    public record Register(@NotBlank @Email @Size(max=320) String email, @NotBlank @Size(max=100) String name,
                           @NotBlank @Size(min=12,max=72) String password, @NotBlank @Size(max=20) String locale, @NotBlank @Size(max=100) String timeZone) {}
    public record Login(@NotBlank @Email @Size(max=320) String email, @NotBlank @Size(max=72) String password, @NotBlank @Size(max=100) String deviceName) {}
    public record EmailInput(@NotBlank @Email @Size(max=320) String email) {}
    public record TokenInput(@NotBlank @Size(max=512) String token) {}
    public record Reset(@NotBlank @Size(max=512) String token, @NotBlank @Size(min=12,max=72) String password) {}
    public record PasswordInput(@NotBlank @Size(max=72) String password) {}
    public record Settings(@NotBlank @Size(max=100) String name, @NotBlank @Size(max=20) String locale, @NotBlank @Size(max=100) String timeZone) {}
    public record Account(UUID userId, String name, String email, boolean emailVerified, String locale, String timeZone, boolean emailVerificationRequired) {
        public static Account from(User user, boolean verificationRequired) { return new Account(user.getId(), user.getName(), user.getEmail(), user.isEmailVerified(), user.getLocale(), user.getTimeZone(), verificationRequired); }
    }
    public record Configuration(boolean emailEnabled, boolean registrationEnabled) {}
    public Configuration configuration() { return new Configuration(access.emailEnabled(), registrationEnabled && access.emailEnabled()); }
    public Account account(User user) { return Account.from(user, access.requiresEmailVerification(user)); }
    public void requireVerified(User user) { access.requireVerified(user); }
    public record Credentials(String token, String refreshToken, Account user) {}
    public static String normalize(String email) { return email.trim().toLowerCase(Locale.ROOT); }
    private void passwordLength(String value) {
        if (value.length() < 12 || value.getBytes(StandardCharsets.UTF_8).length > 72) throw new IllegalArgumentException("Use 12–72 characters and at most 72 UTF-8 bytes for your password");
    }
    @Transactional
    public void register(Register request) {
        if (!configuration().registrationEnabled()) throw new AccessDeniedException("Registration is not open in this environment");
        passwordLength(request.password());
        String email = normalize(request.email());
        Optional<User> existing = users.findByEmail(email);
        if (existing.isPresent()) return;
        User user = users.saveAndFlush(new User(email, request.name(), passwords.encode(request.password()), request.locale(), request.timeZone()));
        challenge(user, "VERIFY");
    }
    @Transactional
    public Credentials login(Login request) {
        User user = users.findByEmail(normalize(request.email())).filter(u -> !u.isDeletionRequested())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid email or password"));
        if (!sessions.allowedAccount(user.getId()) || !passwords.matches(request.password(), user.getPasswordHash())) throw new InvalidCredentialsException("Invalid email or password");
        UUID id = UUID.randomUUID(); String raw = id + "." + tokens.random();
        Instant now = Instant.now();
        jdbc.update("insert into refresh_sessions (id, user_id, token_hash, device_name, authenticated_at, expires_at) values (?, ?, ?, ?, ?, ?)", id, user.getId(), SecretTokens.hash(raw), request.deviceName(), Timestamp.from(now), Timestamp.from(now.plus(Duration.ofDays(30))));
        return new Credentials(jwt.generateToken(user, id), raw, account(user));
    }
    @Transactional(noRollbackFor = InvalidCredentialsException.class)
    public Credentials refresh(String raw) {
        String hash = SecretTokens.hash(raw);
        UUID id;
        try { id = UUID.fromString(raw.split("\\.", 2)[0]); }
        catch (RuntimeException invalid) { throw new InvalidCredentialsException("Session expired"); }
        var session = sessions.lock(id).orElseThrow(() -> new InvalidCredentialsException("Session expired"));
        if (!session.hash().equals(hash)) {
            boolean reused = Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from refresh_token_history where token_hash = ? and session_id = ?)", Boolean.class, hash, id));
            if (reused) sessions.revoke(id, session.userId());
            throw new InvalidCredentialsException("Session expired");
        }
        if (session.revokedAt() != null || !session.expiresAt().isAfter(Instant.now())) throw new InvalidCredentialsException("Session expired");
        User user = users.findById(session.userId()).filter(u -> !u.isDeletionRequested()).orElseThrow(() -> new InvalidCredentialsException("Session expired"));
        if (!sessions.allowedAccount(user.getId())) { sessions.revoke(id,user.getId()); throw new InvalidCredentialsException("Session expired"); }
        String next = id + "." + tokens.random();
        jdbc.update("insert into refresh_token_history (token_hash, session_id) values (?, ?)", hash, id);
        jdbc.update("update refresh_sessions set token_hash = ? where id = ?", SecretTokens.hash(next), id);
        return new Credentials(jwt.generateToken(user, id), next, account(user));
    }
    @Transactional
    public void emailAction(String email, String kind) {
        access.requireEmailDelivery();
        users.findByEmail(normalize(email)).filter(u -> !u.isDeletionRequested()).filter(u -> !kind.equals("VERIFY") || !u.isEmailVerified())
                .ifPresent(u -> { if(sessions.allowedAccount(u.getId())) { users.lockById(u.getId()); challenge(u, kind); } });
    }
    private void challenge(User user, String kind) {
        UUID id = UUID.randomUUID();
        jdbc.update("update identity_actions set consumed_at = current_timestamp where user_id = ? and kind = ? and consumed_at is null", user.getId(), kind);
        jdbc.update("insert into identity_actions (id, user_id, kind, token_hash, expires_at) values (?, ?, ?, ?, ?)", id, user.getId(), kind, SecretTokens.hash(tokens.action(id)), Timestamp.from(Instant.now().plus(kind.equals("RESET") ? Duration.ofHours(1) : Duration.ofDays(1))));
        jobs.enqueue("IDENTITY_EMAIL", id, null, "identity-email:" + id, Instant.now());
    }
    private UUID consume(String raw, String kind) {
        var owners = jdbc.queryForList("select user_id from identity_actions where token_hash = ? and kind = ?", UUID.class, SecretTokens.hash(raw), kind);
        if (owners.isEmpty()) throw new IllegalArgumentException("This link has expired or was already used");
        users.lockById(owners.getFirst()).orElseThrow();
        var results = jdbc.query("select user_id, id from identity_actions where token_hash = ? and kind = ? and consumed_at is null and expires_at > current_timestamp for update", (r,n) -> Map.entry(r.getObject("user_id", UUID.class), r.getObject("id", UUID.class)), SecretTokens.hash(raw), kind);
        if (results.isEmpty()) throw new IllegalArgumentException("This link has expired or was already used");
        var action = results.getFirst();
        jdbc.update("update identity_actions set consumed_at = current_timestamp where id = ?", action.getValue());
        return action.getKey();
    }
    @Transactional
    public void verify(String raw) {
        access.requireEmailDelivery();
        User user = users.lockById(consume(raw, "VERIFY")).orElseThrow();
        if (!sessions.allowedAccount(user.getId())) throw new IllegalArgumentException("Account is unavailable");
        user.verifyEmail();
    }
    @Transactional
    public void reset(Reset request) {
        access.requireEmailDelivery();
        passwordLength(request.password());
        User user = users.lockById(consume(request.token(), "RESET")).orElseThrow();
        if (!sessions.allowedAccount(user.getId())) throw new IllegalArgumentException("Account is unavailable");
        user.changePassword(passwords.encode(request.password())); sessions.revokeAll(user.getId());
        jdbc.update("update identity_actions set consumed_at = current_timestamp where user_id = ? and kind = 'RESET' and consumed_at is null", user.getId());
    }
    @Transactional
    public Account settings(User caller, Settings request) {
        User user = users.lockById(caller.getId()).orElseThrow();
        user.updateSettings(request.name(), request.locale(), request.timeZone()); return account(user);
    }
    @Transactional
    public void reauthenticate(User caller, UUID session, String password) {
        User user = users.findById(caller.getId()).orElseThrow();
        if (!passwords.matches(password, user.getPasswordHash())) throw new AccessDeniedException("Incorrect password. Try again.");
        jdbc.update("update refresh_sessions set authenticated_at = current_timestamp where id = ? and user_id = ? and revoked_at is null", session, user.getId());
    }
}
