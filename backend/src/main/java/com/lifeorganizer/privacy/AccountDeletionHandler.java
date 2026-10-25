package com.lifeorganizer.privacy;

import com.lifeorganizer.jobs.*;
import com.lifeorganizer.memories.CoupleMediaCleanup;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import java.util.*;

/** Delete provider objects first, then database references. Provider failures keep the request retryable. */
@Component
@Profile("couples")
public class AccountDeletionHandler implements DurableJobHandler {
    private final JdbcTemplate jdbc;
    private final CoupleMediaCleanup media;
    private final com.lifeorganizer.wishes.CoupleWishService wishes;
    private final TransactionTemplate transactions;
    public AccountDeletionHandler(JdbcTemplate jdbc,CoupleMediaCleanup media,com.lifeorganizer.wishes.CoupleWishService wishes,PlatformTransactionManager manager) { this.jdbc=jdbc;this.media=media;this.wishes=wishes;transactions=new TransactionTemplate(manager); }
    public String kind() { return "ACCOUNT_DELETION"; }
    public void process(JobStore.Job job) {
        var accounts=jdbc.queryForList("select user_id from deletion_requests where id=? and state='QUEUED'",UUID.class,job.resourceId());
        if(accounts.isEmpty())return;UUID user=accounts.getFirst();
        var groups=jdbc.query("select id,couple_id from memory_groups where creator_id=?",(r,n)->Map.entry(r.getObject("id",UUID.class),r.getObject("couple_id",UUID.class)),user);
        for(var group:groups) {
            jdbc.update("update memory_groups set deleted_at=current_timestamp where id=? and creator_id=?",group.getKey(),user);
            media.group(group.getKey(),group.getValue());
        }
        jdbc.update("delete from wishes where owner_id=?",user);
        Integer pending=jdbc.queryForObject("select count(*) from wish_photos where uploader_id=? and upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes'",Integer.class,user);
        if(pending!=null && pending>0)throw new IllegalStateException("Waiting for an upload to finish");
        jdbc.update("update wish_photos set upload_state='DELETING',delete_after=current_timestamp where uploader_id=?",user);
        for(var photo:jdbc.query("select id,couple_id from wish_photos where uploader_id=?",(r,n)->Map.entry(r.getObject("id",UUID.class),r.getObject("couple_id",UUID.class)),user))wishes.cleanup(photo.getKey(),photo.getValue());
        transactions.executeWithoutResult(tx->{
            jdbc.update("delete from partner_notifications where recipient_id=? or author_id=?",user,user);
            jdbc.update("delete from notes where sender_id=? or recipient_id=?",user,user);
            jdbc.update("delete from watch_reviews where user_id=? or item_id in(select id from watch_items where created_by_id=?)",user,user);
            jdbc.update("delete from watch_items where created_by_id=?",user);
            jdbc.update("delete from couple_invitations where inviter_id=?",user);
            jdbc.update("delete from identity_actions where user_id=?",user);
            jdbc.update("delete from notification_preferences where user_id=?",user);
            jdbc.update("delete from device_registrations where user_id=?",user);
            jdbc.update("delete from refresh_sessions where user_id=?",user);
            jdbc.update("delete from birthday_deliveries where reminder_id in(select id from birthday_reminders where user_id=?)",user);
            jdbc.update("delete from birthday_notifications where user_id=?",user);
            jdbc.update("delete from birthday_reminders where user_id=?",user);
            jdbc.update("delete from agios where user_id=?",user);
            jdbc.update("delete from workout_logs where user_id=?",user);
            jdbc.update("delete from exercise_ticks where user_id=?",user);
            jdbc.update("delete from recipe_ingredients where recipe_id in(select id from recipes where creator_id=?)",user);
            jdbc.update("delete from recipe_steps where recipe_id in(select id from recipes where creator_id=?)",user);
            jdbc.update("delete from recipes where creator_id=?",user);
            jdbc.update("delete from couple_memberships where user_id=?",user);
            jdbc.update("update support_reports set reporter_id=null where reporter_id=?",user);
            jdbc.update("delete from users where id=? and deletion_requested",user);
            jdbc.update("update deletion_requests set state='COMPLETE',completed_at=current_timestamp where id=?",job.resourceId());
        });
    }
}
