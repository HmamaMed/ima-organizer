package com.lifeorganizer.privacy;

import com.lifeorganizer.auth.UserRepository;
import com.lifeorganizer.identity.SessionStore;
import com.lifeorganizer.jobs.JobStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Profile;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** Merge the independently retained marker ledger before starting a restored environment. */
@Service @Profile("couples")
public class DeletionRestoreGuard {
    private final JdbcTemplate jdbc;private final UserRepository users;private final SessionStore sessions;private final JobStore jobs;private final int retention;
    public DeletionRestoreGuard(JdbcTemplate jdbc,UserRepository users,SessionStore sessions,JobStore jobs,@Value("${app.privacy.closed-retention-days:30}")int retention){this.jdbc=jdbc;this.users=users;this.sessions=sessions;this.jobs=jobs;this.retention=retention;}
    @Transactional public void reconcile(UUID userId){
        boolean marked=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from deletion_markers where user_id=?)",Boolean.class,userId));if(!marked)return;
        var found=users.lockById(userId);if(found.isEmpty())return;var user=found.get();user.requestDeletion();sessions.revokeAll(userId);
        for(UUID couple:jdbc.queryForList("select couple_id from couple_memberships where user_id=? and left_at is null",UUID.class,userId)){
            jdbc.queryForList("select id from couples where id=? for update",UUID.class,couple);
            jdbc.update("update couples set status='CLOSED',closed_at=coalesce(closed_at,current_timestamp) where id=?",couple);
            jdbc.update("update couple_memberships set left_at=current_timestamp where couple_id=? and left_at is null",couple);
            jdbc.update("update couple_invitations set revoked_at=current_timestamp where couple_id=? and revoked_at is null",couple);
            jdbc.update("update notes set status='CANCELLED' where couple_id=? and status='SCHEDULED'",couple);jobs.cancelCouple(couple);
            for(UUID group:jdbc.queryForList("select id from memory_groups where couple_id=?",UUID.class,couple)){
                jdbc.update("update memory_groups set deleted_at=current_timestamp where id=? and couple_id=?",group,couple);
                jobs.enqueue("MEMORY_CLEANUP",group,couple,"restore-memory-cleanup:"+group,Instant.now());
            }
            jobs.enqueue("CLOSED_COUPLE_CLEANUP",couple,couple,"restore-couple-cleanup:"+couple,Instant.now().plusSeconds(retention*86400L));
        }
        UUID request=UUID.randomUUID();jdbc.update("insert into deletion_requests(id,user_id) values (?,?) on conflict(user_id) do update set state='QUEUED',completed_at=null",request,userId);
        request=jdbc.queryForObject("select id from deletion_requests where user_id=?",UUID.class,userId);
        jobs.enqueue("ACCOUNT_DELETION",request,null,"account-deletion:"+request,Instant.now());
        jdbc.update("update outbox_jobs set state='READY',attempts=0,next_attempt_at=current_timestamp,lease_until=null where deduplication_key=?","account-deletion:"+request);
    }
    @org.springframework.stereotype.Component @Profile("couples")
    public static class Startup {
        private final JdbcTemplate jdbc;private final DeletionRestoreGuard guard;public Startup(JdbcTemplate jdbc,DeletionRestoreGuard guard){this.jdbc=jdbc;this.guard=guard;}
        @EventListener(ApplicationReadyEvent.class) public void restore(){
            UUID cursor=null;
            while(true){var batch=jdbc.queryForList("select u.id from users u join deletion_markers d on d.user_id=u.id where not u.deletion_requested and (?::uuid is null or u.id>?) order by u.id limit 100",UUID.class,cursor,cursor);if(batch.isEmpty())return;for(UUID id:batch)guard.reconcile(id);cursor=batch.getLast();}
        }
    }
}
