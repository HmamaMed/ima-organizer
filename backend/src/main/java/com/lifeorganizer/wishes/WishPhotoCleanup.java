package com.lifeorganizer.wishes;

import org.springframework.context.annotation.Profile;

import org.slf4j.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
@Profile("!couples")
public class WishPhotoCleanup {
    private static final Logger log = LoggerFactory.getLogger(WishPhotoCleanup.class);
    private final WishPhotoRepository photos;
    private final WishPhotoLedger ledger;
    public WishPhotoCleanup(WishPhotoRepository photos, WishPhotoLedger ledger) { this.photos = photos; this.ledger = ledger; }
    @Scheduled(cron = "${app.wishes.cleanup-cron:0 * * * * *}")
    public void runOnce() {
        Instant now = Instant.now();
        for (var id : photos.findDueIds(now)) {
            try { ledger.purge(id, now); }
            catch (Exception e) { log.warn("Wish photo {} cleanup will retry: {}", id, e.getMessage()); }
        }
    }
}
