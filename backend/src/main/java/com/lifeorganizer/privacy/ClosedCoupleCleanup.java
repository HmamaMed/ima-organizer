package com.lifeorganizer.privacy;

import com.lifeorganizer.jobs.*;
import com.lifeorganizer.memories.CoupleMediaCleanup;
import com.lifeorganizer.wishes.CoupleWishService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Instant;
import java.util.*;

@Component @Profile("couples")
public class ClosedCoupleCleanup implements DurableJobHandler {
    private final JdbcTemplate jdbc;private final CoupleMediaCleanup media;private final CoupleWishService wishes;private final TransactionTemplate tx;private final int days;
    public ClosedCoupleCleanup(JdbcTemplate jdbc,CoupleMediaCleanup media,CoupleWishService wishes,PlatformTransactionManager manager,@Value("${app.privacy.closed-retention-days:30}")int days){this.jdbc=jdbc;this.media=media;this.wishes=wishes;this.tx=new TransactionTemplate(manager);this.days=days;if(days<1||days>90)throw new IllegalArgumentException("Choose a closed-space retention between 1 and 90 days");}
    public String kind(){return "CLOSED_COUPLE_CLEANUP";}
    public void process(JobStore.Job job){UUID couple=job.resourceId();
        var closed=jdbc.query("select closed_at from couples where id=? and status='CLOSED'",(r,n)->r.getTimestamp(1).toInstant(),couple);
        if(closed.isEmpty())return;if(closed.getFirst().plusSeconds(days*86400L).isAfter(Instant.now()))throw new IllegalStateException("Retention window has not ended");
        for(UUID group:jdbc.queryForList("select id from memory_groups where couple_id=?",UUID.class,couple)){jdbc.update("update memory_groups set deleted_at=current_timestamp where id=? and couple_id=?",group,couple);media.group(group,couple);}
        jdbc.update("delete from wishes where couple_id=?",couple);
        jdbc.update("update wish_photos set upload_state='DELETING',delete_after=current_timestamp where couple_id=?",couple);
        for(UUID photo:jdbc.queryForList("select id from wish_photos where couple_id=?",UUID.class,couple))wishes.cleanup(photo,couple);
        tx.executeWithoutResult(status->{
            jdbc.queryForList("select id from couples where id=? and status='CLOSED' for update",UUID.class,couple);
            jdbc.update("delete from partner_notifications where couple_id=?",couple);jdbc.update("delete from notes where couple_id=?",couple);
            jdbc.update("delete from watch_reviews where couple_id=?",couple);jdbc.update("delete from watch_items where couple_id=?",couple);
            jdbc.update("delete from recipe_ingredients where couple_id=?",couple);jdbc.update("delete from recipe_steps where couple_id=?",couple);jdbc.update("delete from recipes where couple_id=?",couple);
            jdbc.update("delete from couple_invitations where couple_id=?",couple);jdbc.update("delete from couple_memberships where couple_id=?",couple);
            jdbc.update("update support_reports set couple_id=null where couple_id=?",couple);jdbc.update("delete from couples where id=? and status='CLOSED'",couple);
        });
    }
}
