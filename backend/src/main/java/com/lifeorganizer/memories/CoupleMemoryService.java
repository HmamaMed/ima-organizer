package com.lifeorganizer.memories;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.couples.CoupleAccess;
import com.lifeorganizer.jobs.JobStore;
import com.lifeorganizer.media.*;
import com.lifeorganizer.notifications.PartnerNotifications;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import java.util.function.Supplier;

@Service
@Profile("couples")
public class CoupleMemoryService {
    private final JdbcTemplate jdbc;
    private final CoupleAccess access;
    private final JobStore jobs;
    private final R2Storage storage;
    private final CoupleMediaValidator validator;
    private final PartnerNotifications notifications;
    private final TransactionTemplate transactions;
    private final long userQuota,coupleQuota;
    public CoupleMemoryService(JdbcTemplate jdbc,CoupleAccess access,JobStore jobs,R2Storage storage,CoupleMediaValidator validator,
                               PartnerNotifications notifications,PlatformTransactionManager manager,
                               @Value("${app.media.user-quota-bytes:104857600}") long userQuota,@Value("${app.media.couple-quota-bytes:209715200}") long coupleQuota) {
        this.jdbc=jdbc;this.access=access;this.jobs=jobs;this.storage=storage;this.validator=validator;this.notifications=notifications;
        this.transactions=new TransactionTemplate(manager);this.userQuota=userQuota;this.coupleQuota=coupleQuota;
    }
    public record Group(UUID id,String name,String description,UUID creatorId,String creatorName,Instant createdAt,Instant expiresAt) {}
    public record Moment(UUID id,UUID groupId,UUID creatorId,String creatorName,String caption,LocalDate memoryDate,String photoUrl,String audioUrl,Instant createdAt,Instant expiresAt) {}
    public record Edit(@Size(max=4000) String caption,@NotNull LocalDate memoryDate) {}
    public record Upload(UUID id,String contentType) {}
    private record Asset(UUID id,String key,String type,long size,UUID groupId,String state,boolean attached) {}
    private final RowMapper<Group> groupMapper=(r,n)->new Group(r.getObject("id",UUID.class),r.getString("name"),r.getString("description"),r.getObject("creator_id",UUID.class),r.getString("creator_name"),r.getTimestamp("created_at").toInstant(),r.getTimestamp("expires_at").toInstant());
    private <T>T write(Supplier<T> action) { return transactions.execute(tx->action.get()); }
    private Group group(User user,UUID id,boolean own,boolean lock) {
        UUID scope=lock?access.requireScopeForWrite(user):access.requireScope(user);
        return jdbc.query("select g.*,u.name creator_name from memory_groups g join users u on u.id=g.creator_id where g.id=? and g.couple_id=? and g.deleted_at is null and g.expires_at>current_timestamp"+(own?" and g.creator_id=?":"")+(lock?" for update of g":""),groupMapper,own?new Object[]{id,scope,user.getId()}:new Object[]{id,scope}).stream().findFirst().orElseThrow(()->new NoSuchElementException("Memory group not found or expired"));
    }
    @Transactional(readOnly=true) public List<Group> groups(User user,int page,int size) {
        UUID scope=access.requireScope(user);
        return jdbc.query("select g.*,u.name creator_name from memory_groups g join users u on u.id=g.creator_id where g.couple_id=? and g.deleted_at is null and g.expires_at>current_timestamp order by g.created_at desc,g.id desc limit ? offset ?",groupMapper,scope,Math.clamp(size,1,100),Math.max(page,0)*(long)Math.clamp(size,1,100));
    }
    @Transactional public Group createGroup(User user,MemoryGroupRequest body,UUID requestId) {
        UUID scope=access.requireScopeForWrite(user);
        var prior=jdbc.queryForList("select id from memory_groups where couple_id=? and creator_id=? and client_request_id=?",UUID.class,scope,user.getId(),requestId);
        if (!prior.isEmpty()) return group(user,prior.getFirst(),true,false);
        Integer count=jdbc.queryForObject("select count(*) from memory_groups where couple_id=? and creator_id=? and deleted_at is null and expires_at>current_timestamp",Integer.class,scope,user.getId());
        if (count!=null && count>=20) throw new IllegalStateException("You can have up to 20 active memory groups");
        UUID id=UUID.randomUUID();Instant now=Instant.now(),expiry=now.plus(Duration.ofHours(72));
        jdbc.update("insert into memory_groups (id,couple_id,creator_id,client_request_id,name,description,created_at,expires_at) values (?,?,?,?,?,?,?,?)",id,scope,user.getId(),requestId,body.name().trim(),body.description(),Timestamp.from(now),Timestamp.from(expiry));
        jobs.enqueue("MEMORY_CLEANUP",id,scope,"memory-cleanup:"+id,expiry);
        return group(user,id,true,false);
    }
    @Transactional public Group editGroup(User user,UUID id,MemoryGroupRequest body) {
        Group group=group(user,id,true,true);
        jdbc.update("update memory_groups set name=?,description=? where id=? and creator_id=?",body.name().trim(),body.description(),id,user.getId());
        return new Group(id,body.name().trim(),body.description(),group.creatorId(),group.creatorName(),group.createdAt(),group.expiresAt());
    }
    @Transactional public void deleteGroup(User user,UUID id) {
        group(user,id,true,true);
        jdbc.update("update memory_groups set deleted_at=current_timestamp where id=? and creator_id=?",id,user.getId());
        jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp,state='READY' where deduplication_key=? and state in ('READY','FAILED')","memory-cleanup:"+id);
    }
    public Upload upload(User user,UUID groupId,MultipartFile file) {
        write(()->group(user,groupId,true,true));
        try (var media=validator.validate(file)) {
            Asset asset=write(()->reserve(user,groupId,media));
            try (var input=java.nio.file.Files.newInputStream(media.path())) {
                storage.upload(asset.key(),input,media.size(),media.type());
                write(()->{
                    group(user,groupId,true,true);
                    if (jdbc.update("update media_assets set upload_state='READY' where id=? and owner_id=? and upload_state='UPLOADING'",asset.id(),user.getId())!=1) throw new IllegalStateException("Upload is no longer available");
                    return null;
                });
                return new Upload(asset.id(),asset.type());
            } catch (RuntimeException | java.io.IOException failure) {
                write(()->{
                    jdbc.update("update media_assets set upload_state='DELETING' where id=? and owner_id=?",asset.id(),user.getId());
                    jdbc.update("update outbox_jobs set next_attempt_at=current_timestamp,state='READY' where deduplication_key=? and state in ('READY','FAILED')","asset-cleanup:"+asset.id());
                    return null;
                });
                if (failure instanceof RuntimeException runtime) throw runtime;
                throw new MediaStorageException("The media could not be uploaded");
            }
        }
    }
    private Asset reserve(User user,UUID groupId,CoupleMediaValidator.Validated media) {
        Group group=group(user,groupId,true,true);UUID scope=access.requireScope(user);
        Long used=jdbc.queryForObject("select (select coalesce(sum(size),0) from media_assets where couple_id=?)+(select coalesce(sum(size),0) from wish_photos where couple_id=?)",Long.class,scope,scope);
        Long own=jdbc.queryForObject("select (select coalesce(sum(size),0) from media_assets where owner_id=?)+(select coalesce(sum(size),0) from wish_photos where uploader_id=?)",Long.class,user.getId(),user.getId());
        if (used==null || own==null || used+media.size()>coupleQuota || own+media.size()>userQuota) throw new IllegalStateException("Temporary media storage limit reached. Remove a group or wait for cleanup.");
        Integer pending=jdbc.queryForObject("select (select count(*) from media_assets where owner_id=? and upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes')+(select count(*) from wish_photos where uploader_id=? and upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes')",Integer.class,user.getId(),user.getId());
        if (pending!=null && pending>=2) throw new IllegalStateException("Wait for your other uploads to finish");
        UUID id=UUID.randomUUID();String key="couples/"+scope+"/assets/"+id;
        jdbc.update("insert into media_assets (id,group_id,couple_id,owner_id,object_key,content_type,size,created_at,attached,upload_state) values (?,?,?,?,?,?,?,current_timestamp,false,'UPLOADING')",id,group.id(),scope,user.getId(),key,media.type(),media.size());
        jobs.enqueue("ASSET_CLEANUP",id,scope,"asset-cleanup:"+id,Instant.now().plus(Duration.ofHours(24)));
        return new Asset(id,key,media.type(),media.size(),groupId,"UPLOADING",false);
    }
    private Asset asset(User user,UUID id,UUID group,UUID scope,String type) {
        return jdbc.query("select * from media_assets where id=? and group_id=? and couple_id=? and owner_id=? and not attached and upload_state='READY' and content_type like ? for update",(r,n)->new Asset(r.getObject("id",UUID.class),r.getString("object_key"),r.getString("content_type"),r.getLong("size"),r.getObject("group_id",UUID.class),r.getString("upload_state"),r.getBoolean("attached")),id,group,scope,user.getId(),type+"%").stream().findFirst().orElseThrow(()->new NoSuchElementException("Unused media upload not found in this group"));
    }
    @Transactional public Moment create(User user,MemoryRequest body,UUID requestId) {
        Group group=group(user,body.groupId(),true,true);UUID scope=access.requireScope(user);
        var prior=jdbc.queryForList("select id from memories where couple_id=? and creator_id=? and client_request_id=?",UUID.class,scope,user.getId(),requestId);
        if (!prior.isEmpty()) return get(user,prior.getFirst());
        Integer count=jdbc.queryForObject("select count(*) from memories where group_id=? and couple_id=? and deleted_at is null",Integer.class,group.id(),scope);
        if (count!=null && count>=100) throw new IllegalStateException("A group can contain up to 100 moments");
        Asset photo=asset(user,body.photoAssetId(),group.id(),scope,"image/"),audio=body.audioAssetId()==null?null:asset(user,body.audioAssetId(),group.id(),scope,"audio/");
        UUID id=UUID.randomUUID();
        jdbc.update("insert into memories (id,group_id,couple_id,creator_id,client_request_id,photo_asset_id,audio_asset_id,photo_url,audio_url,caption,memory_date,created_at) values (?,?,?,?,?,?,?,?,?,?,?,current_timestamp)",id,group.id(),scope,user.getId(),requestId,photo.id(),audio==null?null:audio.id(),"r2://"+photo.key(),audio==null?null:"r2://"+audio.key(),body.caption(),body.memoryDate());
        jdbc.update("update media_assets set attached=true where (id=? or id=?) and couple_id=? and owner_id=?",photo.id(),audio==null?null:audio.id(),scope,user.getId());
        notifications.other(scope,user.getId()).ifPresent(partner->notifications.publish(scope,user.getId(),partner,"MEMORY",id));
        return get(user,id);
    }
    private String select() { return "select m.*,u.name creator_name,g.expires_at,p.object_key photo_key,a.object_key audio_key from memories m join memory_groups g on g.id=m.group_id join users u on u.id=m.creator_id join media_assets p on p.id=m.photo_asset_id left join media_assets a on a.id=m.audio_asset_id "; }
    private RowMapper<Moment> momentMapper() { return (r,n)->{
        Instant expiry=r.getTimestamp("expires_at").toInstant(),now=Instant.now();String audio=r.getString("audio_key");
        return new Moment(r.getObject("id",UUID.class),r.getObject("group_id",UUID.class),r.getObject("creator_id",UUID.class),r.getString("creator_name"),r.getString("caption"),r.getObject("memory_date",LocalDate.class),storage.readUrl(r.getString("photo_key"),expiry,now),audio==null?null:storage.readUrl(audio,expiry,now),r.getTimestamp("created_at").toInstant(),expiry);
    }; }
    @Transactional(readOnly=true) public List<Moment> list(User user,UUID groupId,int page,int size) {
        UUID scope=access.requireScope(user);
        if (groupId!=null) group(user,groupId,false,false);
        return jdbc.query(select()+"where m.couple_id=? and m.deleted_at is null and g.deleted_at is null and g.expires_at>current_timestamp"+(groupId==null?"":" and m.group_id=?")+" order by m.created_at desc,m.id desc limit ? offset ?",momentMapper(),groupId==null?new Object[]{scope,Math.clamp(size,1,100),Math.max(page,0)*(long)Math.clamp(size,1,100)}:new Object[]{scope,groupId,Math.clamp(size,1,100),Math.max(page,0)*(long)Math.clamp(size,1,100)});
    }
    @Transactional(readOnly=true) public Moment get(User user,UUID id) {
        UUID scope=access.requireScope(user);
        return jdbc.query(select()+"where m.id=? and m.couple_id=? and m.deleted_at is null and g.deleted_at is null and g.expires_at>current_timestamp",momentMapper(),id,scope).stream().findFirst().orElseThrow(()->new NoSuchElementException("Moment not found or expired"));
    }
    @Transactional public Moment edit(User user,UUID id,Edit body) {
        UUID scope=access.requireScopeForWrite(user);
        var groups=jdbc.queryForList("select group_id from memories where id=? and couple_id=? and creator_id=? and deleted_at is null",UUID.class,id,scope,user.getId());
        if (groups.isEmpty()) throw new NoSuchElementException("Editable moment not found");
        group(user,groups.getFirst(),true,true);
        jdbc.update("update memories set caption=?,memory_date=? where id=? and couple_id=? and creator_id=?",body.caption(),body.memoryDate(),id,scope,user.getId());return get(user,id);
    }
    @Transactional public void delete(User user,UUID id) {
        UUID scope=access.requireScopeForWrite(user);
        var groups=jdbc.queryForList("select group_id from memories where id=? and couple_id=? and creator_id=? and deleted_at is null",UUID.class,id,scope,user.getId());
        if (groups.isEmpty()) throw new NoSuchElementException("Editable moment not found");
        group(user,groups.getFirst(),true,true);
        jdbc.update("update memories set deleted_at=current_timestamp where id=? and couple_id=?",id,scope);
        jobs.enqueue("MEMORY_ENTRY_CLEANUP",id,scope,"moment-cleanup:"+id,Instant.now());
    }
}
