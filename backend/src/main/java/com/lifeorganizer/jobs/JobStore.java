package com.lifeorganizer.jobs;

import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Repository
@Profile("couples")
public class JobStore {
    private final JdbcTemplate jdbc;
    public JobStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public record Job(UUID id, String kind, UUID resourceId, UUID coupleId, UUID leaseToken, int attempts) {}
    public void enqueue(String kind, UUID resource, UUID couple, String key, Instant due) {
        jdbc.update("insert into outbox_jobs (id, kind, resource_id, couple_id, deduplication_key, next_attempt_at) values (?, ?, ?, ?, ?, ?) on conflict (deduplication_key) do nothing", UUID.randomUUID(), kind, resource, couple, key, Timestamp.from(due));
    }
    public Optional<Job> claim() {
        UUID lease = UUID.randomUUID();
        return jdbc.query("""
            update outbox_jobs set state = 'RUNNING', attempts = attempts + 1, lease_token = ?, lease_until = current_timestamp + interval '2 minutes'
            where id = (select id from outbox_jobs where
                (state = 'READY' and next_attempt_at <= current_timestamp) or (state = 'RUNNING' and lease_until <= current_timestamp)
                order by next_attempt_at, id limit 1 for update skip locked)
            returning id, kind, resource_id, couple_id, lease_token, attempts
            """, (r, n) -> new Job(r.getObject("id", UUID.class), r.getString("kind"), r.getObject("resource_id", UUID.class), r.getObject("couple_id", UUID.class), r.getObject("lease_token", UUID.class), r.getInt("attempts")), lease).stream().findFirst();
    }
    public void complete(Job job) {
        jdbc.update("update outbox_jobs set state = 'DONE', lease_until = null where id = ? and lease_token = ? and state = 'RUNNING'", job.id(), job.leaseToken());
    }
    public void retry(Job job) {
        long delay = Math.min(3600, 15L * (1L << Math.min(job.attempts(), 8)));
        jdbc.update("update outbox_jobs set state = ?, next_attempt_at = ?, lease_until = null, last_error = 'DELIVERY_FAILED' where id = ? and lease_token = ? and state = 'RUNNING'", job.attempts() >= 10 ? "FAILED" : "READY", Timestamp.from(Instant.now().plusSeconds(delay)), job.id(), job.leaseToken());
    }
    public void cancelCouple(UUID couple) {
        jdbc.update("update outbox_jobs set state = 'CANCELLED', lease_until = null where couple_id = ? and kind in ('NOTE_DELIVERY', 'PARTNER_PUSH') and state in ('READY', 'RUNNING')", couple);
    }
}
