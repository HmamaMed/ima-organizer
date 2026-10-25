package com.lifeorganizer.memories;

import com.lifeorganizer.media.R2Storage;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import com.lifeorganizer.jobs.*;
import java.util.*;
import java.util.function.Consumer;

@Service
@Profile("couples")
public class CoupleMediaCleanup {
    private final JdbcTemplate jdbc;
    private final R2Storage storage;
    private final TransactionTemplate transactions;
    public CoupleMediaCleanup(JdbcTemplate jdbc,R2Storage storage,PlatformTransactionManager manager) { this.jdbc=jdbc;this.storage=storage;transactions=new TransactionTemplate(manager); }
    private record ObjectRef(UUID id,String key) {}
    private List<ObjectRef> assets(UUID group,UUID couple) {
        Integer pending=jdbc.queryForObject("select count(*) from media_assets where group_id=? and couple_id=? and upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes'",Integer.class,group,couple);
        if (pending!=null && pending>0) throw new IllegalStateException("Waiting for an upload to finish");
        return jdbc.query("select id,object_key from media_assets where group_id=? and couple_id=?",(r,n)->new ObjectRef(r.getObject("id",UUID.class),r.getString("object_key")),group,couple);
    }
    private void deleteObject(ObjectRef asset,UUID couple) {
        if (!asset.key().equals("couples/"+couple+"/assets/"+asset.id())) throw new IllegalStateException("Object ownership could not be confirmed");
        storage.deleteObject(asset.key());
    }
    public void group(UUID group,UUID couple) {
        Integer hidden=jdbc.queryForObject("select count(*) from memory_groups where id=? and couple_id=? and (deleted_at is not null or expires_at<=current_timestamp)",Integer.class,group,couple);
        if (hidden==null || hidden==0) return;
        var assets=assets(group,couple);
        for (var asset:assets) deleteObject(asset,couple);
        transactions.executeWithoutResult(tx->{
            jdbc.update("delete from memories where group_id=? and couple_id=?",group,couple);
            jdbc.update("delete from media_assets where group_id=? and couple_id=?",group,couple);
            jdbc.update("delete from memory_groups where id=? and couple_id=? and (deleted_at is not null or expires_at<=current_timestamp)",group,couple);
        });
    }
    public void moment(UUID id,UUID couple) {
        var references=jdbc.queryForList("select photo_asset_id,audio_asset_id from memories where id=? and couple_id=? and deleted_at is not null",id,couple);
        if (references.isEmpty()) return;
        var row=references.getFirst();UUID photo=(UUID)row.get("photo_asset_id"),audio=(UUID)row.get("audio_asset_id");
        var assets=jdbc.query("select id,object_key from media_assets where couple_id=? and (id=? or id=?)",(r,n)->new ObjectRef(r.getObject("id",UUID.class),r.getString("object_key")),couple,photo,audio);
        for (var asset:assets) deleteObject(asset,couple);
        transactions.executeWithoutResult(tx->{
            jdbc.update("delete from memories where id=? and couple_id=? and deleted_at is not null",id,couple);
            jdbc.update("delete from media_assets where couple_id=? and (id=? or id=?)",couple,photo,audio);
        });
    }
    public void asset(UUID id,UUID couple) {
        var assets=jdbc.query("select id,object_key from media_assets where id=? and couple_id=? and not attached and (upload_state='DELETING' or created_at<=current_timestamp-interval '24 hours') and not(upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes')",(r,n)->new ObjectRef(r.getObject("id",UUID.class),r.getString("object_key")),id,couple);
        for (var asset:assets) {
            deleteObject(asset,couple);
            jdbc.update("delete from media_assets where id=? and couple_id=? and not attached",id,couple);
        }
    }
    @Configuration @Profile("couples")
    public static class Handlers {
        private record Handler(String kind,Consumer<JobStore.Job> action) implements DurableJobHandler { public void process(JobStore.Job job) { action.accept(job); } }
        @Bean DurableJobHandler groupCleanup(CoupleMediaCleanup cleanup) { return new Handler("MEMORY_CLEANUP",job->cleanup.group(job.resourceId(),job.coupleId())); }
        @Bean DurableJobHandler entryCleanup(CoupleMediaCleanup cleanup) { return new Handler("MEMORY_ENTRY_CLEANUP",job->cleanup.moment(job.resourceId(),job.coupleId())); }
        @Bean DurableJobHandler assetCleanup(CoupleMediaCleanup cleanup) { return new Handler("ASSET_CLEANUP",job->cleanup.asset(job.resourceId(),job.coupleId())); }
    }
}
