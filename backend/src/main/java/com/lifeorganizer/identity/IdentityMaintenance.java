package com.lifeorganizer.identity;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Profile("couples")
@ConditionalOnProperty(name="app.jobs.enabled",havingValue="true",matchIfMissing=true)
public class IdentityMaintenance {
    private final JdbcTemplate jdbc;public IdentityMaintenance(JdbcTemplate jdbc){this.jdbc=jdbc;}
    @Scheduled(fixedDelayString="${app.identity.maintenance-ms:3600000}") @Transactional public void sweep(){
        jdbc.update("delete from abuse_limits where created_at<current_timestamp-interval '48 hours'");
        jdbc.update("delete from outbox_jobs where state in ('DONE','CANCELLED') and created_at<current_timestamp-interval '30 days'");
        jdbc.update("delete from identity_actions where expires_at<current_timestamp-interval '1 day'");
        jdbc.update("delete from device_registrations where session_id in(select id from refresh_sessions where expires_at<current_timestamp)");
        jdbc.update("delete from refresh_sessions where expires_at<current_timestamp");
    }
}
