package com.lifeorganizer.notes;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Expired content disappears from reads immediately; physical cleanup runs in bounded batches. */
@Component
@Profile("couples")
@ConditionalOnProperty(name="app.jobs.enabled",havingValue="true",matchIfMissing=true)
public class NoteRetentionCleanup {
    private final JdbcTemplate jdbc;
    public NoteRetentionCleanup(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    @Scheduled(fixedDelay=900000,initialDelay=60000)
    @Transactional
    public void clean() {
        jdbc.queryForObject("""
            with expired as materialized (
                select id from notes where status='SENT' and sent_at <= current_timestamp - interval '7 days'
                order by sent_at,id limit 500 for update skip locked
            ), notifications as (
                delete from partner_notifications where kind='NOTE' and resource_id in (select id from expired) returning id
            ), jobs as (
                delete from outbox_jobs where
                  (kind='NOTE_DELIVERY' and resource_id in (select id from expired)) or
                  (kind='PARTNER_PUSH' and resource_id in (select id from notifications))
            ), removed as (
                delete from notes where id in (select id from expired) returning id
            ) select count(*) from removed
            """,Long.class);
    }
}
