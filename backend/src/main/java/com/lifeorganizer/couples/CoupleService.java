package com.lifeorganizer.couples;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.identity.*;
import com.lifeorganizer.jobs.JobStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;

@Service
@Profile("couples")
@Transactional(readOnly=true)
public class CoupleService {
    private final UserRepository users;
    private final CoupleRepository couples;
    private final CoupleMembershipRepository memberships;
    private final CoupleAccess access;
    private final JdbcTemplate jdbc;
    private final SecretTokens tokens;
    private final JobStore jobs;
    private final String publicUrl;
    private final int retentionDays;
    public CoupleService(UserRepository users, CoupleRepository couples, CoupleMembershipRepository memberships,
                         CoupleAccess access, JdbcTemplate jdbc, SecretTokens tokens, JobStore jobs,
                         @Value("${app.public-url}") String publicUrl,@Value("${app.privacy.closed-retention-days:30}")int retentionDays) {
        this.users=users; this.couples=couples; this.memberships=memberships; this.access=access;
        this.jdbc=jdbc; this.tokens=tokens; this.jobs=jobs; this.retentionDays=retentionDays; this.publicUrl=publicUrl.replaceAll("/+$", "");
    }
    public record Member(UUID userId, String name) {}
    public record Space(UUID coupleId, String status, List<Member> members) {}
    public record Invitation(String url, String token, Instant expiresAt) {}
    public record Preview(String inviterName, Instant expiresAt) {}
    private record Invite(UUID id, UUID couple, UUID inviter, String email, Instant expiry, Instant consumed, Instant revoked) {}

    public Space current(User user) {
        var membership=memberships.findByUserIdAndLeftAtIsNull(user.getId());
        if (membership.isEmpty()) {
            boolean prior=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from couple_memberships where user_id = ?)",Boolean.class,user.getId()));
            return new Space(null, prior ? "DISCONNECTED" : "UNPAIRED", List.of());
        }
        var couple=membership.get().getCouple();
        if (couple.getStatus()==Couple.Status.CLOSED || Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from couple_memberships m join deletion_markers d on d.user_id=m.user_id where m.couple_id=?)",Boolean.class,couple.getId()))) return new Space(null,"DISCONNECTED",List.of());
        var members=jdbc.query("select u.id, u.name from couple_memberships m join users u on u.id = m.user_id where m.couple_id = ? and m.left_at is null order by m.slot", (r,n)->new Member(r.getObject("id",UUID.class),r.getString("name")),couple.getId());
        return new Space(couple.getId(),couple.getStatus().name(),members);
    }
    @Transactional
    public Space create(User caller) {
        User user=users.lockById(caller.getId()).orElseThrow(); IdentityService.requireVerified(user);
        if (memberships.findByUserIdAndLeftAtIsNull(user.getId()).isPresent()) return current(user);
        Couple couple=couples.saveAndFlush(new Couple(Instant.now()));
        memberships.saveAndFlush(new CoupleMembership(couple,user,1,Instant.now()));
        return current(user);
    }
    @Transactional
    public Invitation invite(User caller, String intendedEmail) {
        User user=users.lockById(caller.getId()).orElseThrow(); IdentityService.requireVerified(user);
        UUID scope=access.requireScopeForWrite(user);
        if (couples.findById(scope).orElseThrow().getStatus()!=Couple.Status.WAITING) throw new IllegalStateException("Your couple already has two members");
        String email=intendedEmail==null || intendedEmail.isBlank() ? null : IdentityService.normalize(intendedEmail);
        if (Objects.equals(email,user.getEmail())) throw new IllegalArgumentException("Invite your partner using a different email address");
        jdbc.update("update couple_invitations set revoked_at = current_timestamp where couple_id = ? and consumed_at is null and revoked_at is null",scope);
        String raw=tokens.random(); Instant expiry=Instant.now().plus(Duration.ofHours(24));
        jdbc.update("insert into couple_invitations (id,couple_id,inviter_id,token_hash,intended_email,expires_at) values (?,?,?,?,?,?)",UUID.randomUUID(),scope,user.getId(),SecretTokens.hash(raw),email,Timestamp.from(expiry));
        return new Invitation(publicUrl+"/join#invitation="+raw,raw,expiry);
    }
    private Invite invitation(String raw, boolean lock) {
        var found=jdbc.query("select * from couple_invitations where token_hash = ?"+(lock ? " for update" : ""),(r,n)->new Invite(r.getObject("id",UUID.class),r.getObject("couple_id",UUID.class),r.getObject("inviter_id",UUID.class),r.getString("intended_email"),r.getTimestamp("expires_at").toInstant(),r.getTimestamp("consumed_at")==null?null:r.getTimestamp("consumed_at").toInstant(),r.getTimestamp("revoked_at")==null?null:r.getTimestamp("revoked_at").toInstant()),SecretTokens.hash(raw));
        if (found.isEmpty()) throw new NoSuchElementException("Invitation is unavailable or expired");
        return found.getFirst();
    }
    private void validate(Invite invite, User user) {
        if (invite.consumed()!=null || invite.revoked()!=null || !invite.expiry().isAfter(Instant.now())) throw new NoSuchElementException("Invitation is unavailable or expired");
        if (Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from deletion_markers where user_id=?)",Boolean.class,invite.inviter()))) throw new NoSuchElementException("Invitation is unavailable or expired");
        if (invite.inviter().equals(user.getId())) throw new IllegalArgumentException("You cannot accept your own invitation");
        if (invite.email()!=null && !invite.email().equals(user.getEmail())) throw new AccessDeniedException("Sign in with the email address this invitation was sent to");
        if (!memberships.existsByUserIdAndCoupleIdAndLeftAtIsNull(invite.inviter(),invite.couple())) throw new NoSuchElementException("Invitation is unavailable or expired");
    }
    public Preview preview(User caller, String raw) {
        IdentityService.requireVerified(caller);
        var invite=invitation(raw,false); validate(invite,caller);
        if (couples.findById(invite.couple()).orElseThrow().getStatus()!=Couple.Status.WAITING) throw new NoSuchElementException("Invitation is unavailable or expired");
        return new Preview(users.findById(invite.inviter()).orElseThrow().getName(),invite.expiry());
    }
    @Transactional
    public Space accept(User caller, String raw) {
        User user=users.lockById(caller.getId()).orElseThrow(); IdentityService.requireVerified(user);
        if (memberships.findByUserIdAndLeftAtIsNull(user.getId()).isPresent()) throw new IllegalStateException("Disconnect from your current space before joining another");
        Invite initial=invitation(raw,false);
        Couple couple=couples.lockById(initial.couple()).orElseThrow();
        Invite invite=invitation(raw,true); validate(invite,user);
        if (couple.getStatus()!=Couple.Status.WAITING) throw new IllegalStateException("This space is already paired or closed");
        Integer count=jdbc.queryForObject("select count(*) from couple_memberships where couple_id = ? and left_at is null",Integer.class,couple.getId());
        if (count==null || count!=1) throw new IllegalStateException("Invitation is unavailable");
        memberships.saveAndFlush(new CoupleMembership(couple,user,2,Instant.now()));
        couple.activate();
        jdbc.update("update couple_invitations set consumed_at = current_timestamp where id = ?",invite.id());
        jdbc.update("update couple_invitations set revoked_at = current_timestamp where couple_id = ? and consumed_at is null and revoked_at is null",couple.getId());
        return current(user);
    }
    @Transactional
    public void revokeInvitation(User caller) {
        UUID scope=access.requireScopeForWrite(caller);
        jdbc.update("update couple_invitations set revoked_at = current_timestamp where couple_id = ? and revoked_at is null and consumed_at is null",scope);
    }
    @Transactional
    public void disconnect(User caller) {
        users.lockById(caller.getId()).orElseThrow();
        UUID scope=access.requireScopeForWrite(caller);
        Couple couple=couples.findById(scope).orElseThrow(); couple.close(Instant.now());
        jdbc.update("update couple_memberships set left_at = current_timestamp where couple_id = ? and left_at is null",scope);
        jdbc.update("update couple_invitations set revoked_at = current_timestamp where couple_id = ? and revoked_at is null and consumed_at is null",scope);
        jobs.cancelCouple(scope);
        jobs.enqueue("CLOSED_COUPLE_CLEANUP",scope,scope,"closed-couple-cleanup:"+scope,Instant.now().plusSeconds(retentionDays*86400L));
        jdbc.update("update notes set status = 'CANCELLED' where couple_id = ? and status = 'SCHEDULED'",scope);
        for (UUID group:jdbc.queryForList("select id from memory_groups where couple_id = ?",UUID.class,scope)) {
            jdbc.update("update memory_groups set deleted_at = current_timestamp where id = ?",group);
            jobs.enqueue("MEMORY_CLEANUP",group,scope,"memory-cleanup:"+group,Instant.now());
            jdbc.update("update outbox_jobs set next_attempt_at = current_timestamp where deduplication_key = ? and state = 'READY'","memory-cleanup:"+group);
        }
    }
}
