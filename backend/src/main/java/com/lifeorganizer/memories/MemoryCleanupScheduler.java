package com.lifeorganizer.memories;

import org.springframework.context.annotation.Profile;

import org.slf4j.*;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
@Profile("!couples")
public class MemoryCleanupScheduler {
    private static final Logger log = LoggerFactory.getLogger(MemoryCleanupScheduler.class);
    private final MemoryCleanupService cleanup;
    private final MemoryGroupRepository groups;
    public MemoryCleanupScheduler(MemoryCleanupService cleanup, MemoryGroupRepository groups) { this.cleanup = cleanup; this.groups = groups; }
    @EventListener(ApplicationReadyEvent.class)
    public void queueExistingMemories() { cleanup.queueLegacy(); }
    @Scheduled(cron = "${app.memories.cleanup-cron:0 * * * * *}")
    public void runOnce() {
        cleanup.queueLegacy();
        Instant now = Instant.now();
        for (var id : groups.findDueIds(now)) {
            try { cleanup.purge(id,now); }
            catch (Exception e) { log.warn("Memory category {} is hidden; file cleanup will retry: {}",id,e.getMessage()); }
        }
    }
    @Scheduled(cron = "${app.memories.orphan-cron:0 15 * * * *}")
    public void cleanAbandonedUploads() {
        for (var id : groups.findGroupIds()) {
            try { cleanup.removeAbandonedUploads(id,Instant.now()); }
            catch (Exception e) { log.warn("Abandoned media cleanup for {} will retry: {}",id,e.getMessage()); }
        }
    }
}
