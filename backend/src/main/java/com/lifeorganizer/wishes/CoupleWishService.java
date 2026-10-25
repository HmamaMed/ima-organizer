package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.couples.CoupleAccess;
import com.lifeorganizer.media.*;
import com.lifeorganizer.jobs.JobStore;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;
import java.time.*;
import java.util.*;

@Service @Profile("couples")
public class CoupleWishService {
    private final JdbcTemplate jdbc;private final CoupleAccess access;private final R2Storage storage;private final CoupleMediaValidator validator;private final JobStore jobs;private final TransactionTemplate tx;private final long userQuota,coupleQuota;
    public CoupleWishService(JdbcTemplate jdbc,CoupleAccess access,R2Storage storage,CoupleMediaValidator validator,JobStore jobs,PlatformTransactionManager manager,@org.springframework.beans.factory.annotation.Value("${app.media.user-quota-bytes:104857600}")long userQuota,@org.springframework.beans.factory.annotation.Value("${app.media.couple-quota-bytes:209715200}")long coupleQuota){this.jdbc=jdbc;this.access=access;this.storage=storage;this.validator=validator;this.jobs=jobs;tx=new TransactionTemplate(manager);this.userQuota=userQuota;this.coupleQuota=coupleQuota;}
    public record Wish(UUID id,String title,WishCategory category,String details,String link,UUID photoId,String photoUrl,Instant createdAt,UUID ownerId,String ownerName){}
    private RowMapper<Wish> mapper(){return(r,n)->{String key=r.getString("object_key");return new Wish(r.getObject("id",UUID.class),r.getString("title"),WishCategory.valueOf(r.getString("category")),r.getString("details"),r.getString("link"),r.getObject("photo_id",UUID.class),key==null?null:storage.readUrl(key,null,Instant.now()),r.getTimestamp("created_at").toInstant(),r.getObject("owner_id",UUID.class),r.getString("owner_name"));};}
    private static final String SELECT="select w.*,u.name owner_name,p.object_key from wishes w join users u on u.id=w.owner_id left join wish_photos p on p.id=w.photo_id ";
    @Transactional(readOnly=true) public List<Wish> list(User user,int page,int size){UUID scope=access.requireScope(user);return jdbc.query(SELECT+"where w.couple_id=? order by w.created_at desc,w.id desc limit ? offset ?",mapper(),scope,Math.clamp(size,1,100),Math.max(0,page)*(long)Math.clamp(size,1,100));}
    @Transactional(readOnly=true) public Wish get(User user,UUID id){UUID scope=access.requireScope(user);return jdbc.query(SELECT+"where w.id=? and w.couple_id=?",mapper(),id,scope).stream().findFirst().orElseThrow(()->new NoSuchElementException("Wish not found"));}
    private UUID owned(User user,UUID id){UUID scope=access.requireScopeForWrite(user);if(jdbc.queryForList("select id from wishes where id=? and couple_id=? and owner_id=? for update",UUID.class,id,scope,user.getId()).isEmpty())throw new NoSuchElementException("Your wish was not found");return scope;}
    private void photo(User user,UUID scope,UUID photo,UUID excluded){if(photo==null)return;boolean valid=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from wish_photos p where p.id=? and p.couple_id=? and p.uploader_id=? and p.ready and p.upload_state='READY' and p.delete_after is null and not exists(select 1 from wishes w where w.photo_id=p.id and (?::uuid is null or w.id<>?)))",Boolean.class,photo,scope,user.getId(),excluded,excluded));if(!valid)throw new NoSuchElementException("Unused wish photo not found");}
    @Transactional public Wish create(User user,WishRequest body,UUID key){UUID scope=access.requireScopeForWrite(user);var prior=jdbc.queryForList("select id from wishes where couple_id=? and owner_id=? and client_request_id=?",UUID.class,scope,user.getId(),key);if(!prior.isEmpty())return get(user,prior.getFirst());photo(user,scope,body.photoId(),null);UUID id=UUID.randomUUID();jdbc.update("insert into wishes(id,couple_id,owner_id,client_request_id,title,category,details,link,photo_id,created_at) values (?,?,?,?,?,?,?,?,?,current_timestamp)",id,scope,user.getId(),key,body.title().trim(),body.category().name(),body.details(),body.link(),body.photoId());return get(user,id);}
    private void queuePhoto(UUID id,UUID scope){if(id==null)return;jdbc.update("update wish_photos set delete_after=current_timestamp,upload_state='DELETING' where id=? and couple_id=?",id,scope);jobs.enqueue("WISH_PHOTO_CLEANUP",id,scope,"wish-photo-delete:"+id,Instant.now());}
    @Transactional public Wish update(User user,UUID id,WishRequest body){UUID scope=owned(user,id);UUID previous=jdbc.queryForObject("select photo_id from wishes where id=? and couple_id=?",UUID.class,id,scope);photo(user,scope,body.photoId(),id);jdbc.update("update wishes set title=?,category=?,details=?,link=?,photo_id=? where id=? and couple_id=? and owner_id=?",body.title().trim(),body.category().name(),body.details(),body.link(),body.photoId(),id,scope,user.getId());if(!Objects.equals(previous,body.photoId()))queuePhoto(previous,scope);return get(user,id);}
    @Transactional public void delete(User user,UUID id){UUID scope=owned(user,id);UUID previous=jdbc.queryForObject("select photo_id from wishes where id=? and couple_id=?",UUID.class,id,scope);jdbc.update("delete from wishes where id=? and couple_id=? and owner_id=?",id,scope,user.getId());queuePhoto(previous,scope);}
    public record Upload(UUID id){}
    public Upload upload(User user,MultipartFile file){
        if(!MediaUploadService.type(file.getContentType()).startsWith("image/")||file.getSize()>10L*1024*1024)throw new IllegalArgumentException("Choose a JPEG/PNG photo up to 10 MB");
        tx.execute(status->access.requireScopeForWrite(user));
        try(var media=validator.validate(file)){
            UUID id=UUID.randomUUID();UUID scope=tx.execute(status->{
                UUID current=access.requireScopeForWrite(user);
                long used=Objects.requireNonNull(jdbc.queryForObject("select (select coalesce(sum(size),0) from media_assets where couple_id=?)+(select coalesce(sum(size),0) from wish_photos where couple_id=?)",Long.class,current,current));
                long own=Objects.requireNonNull(jdbc.queryForObject("select (select coalesce(sum(size),0) from media_assets where owner_id=?)+(select coalesce(sum(size),0) from wish_photos where uploader_id=?)",Long.class,user.getId(),user.getId()));
                int pending=Objects.requireNonNull(jdbc.queryForObject("select (select count(*) from media_assets where owner_id=? and upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes')+(select count(*) from wish_photos where uploader_id=? and upload_state='UPLOADING' and created_at>current_timestamp-interval '10 minutes')",Integer.class,user.getId(),user.getId()));
                if(used+media.size()>coupleQuota||own+media.size()>userQuota)throw new IllegalStateException("Media storage limit reached");if(pending>=2)throw new IllegalStateException("Wait for your other uploads to finish");
                jdbc.update("insert into wish_photos(id,couple_id,uploader_id,object_key,size,ready,upload_state) values (?,?,?,?,?,false,'UPLOADING')",id,current,user.getId(),key(current,id),media.size());jobs.enqueue("WISH_PHOTO_CLEANUP",id,current,"wish-photo-orphan:"+id,Instant.now().plus(Duration.ofHours(24)));return current;
            });
            try(var input=java.nio.file.Files.newInputStream(media.path())){
                storage.upload(key(scope,id),input,media.size(),media.type());
                tx.executeWithoutResult(status->{UUID current=access.requireScopeForWrite(user);if(!current.equals(scope))throw new IllegalStateException("Your couple has changed");if(jdbc.update("update wish_photos set ready=true,upload_state='READY' where id=? and couple_id=? and upload_state='UPLOADING'",id,scope)!=1)throw new IllegalStateException("Upload unavailable");});return new Upload(id);
            }catch(RuntimeException|java.io.IOException failure){tx.executeWithoutResult(status->queuePhoto(id,scope));if(failure instanceof RuntimeException runtime)throw runtime;throw new MediaStorageException("Could not upload this photo");}
        }
    }
    public static String key(UUID couple,UUID photo){return "couples/"+couple+"/wish-photos/"+photo;}
    /** Called outside a DB transaction by a durable cleanup job or account deletion. */
    public void cleanup(UUID id,UUID scope){
        var photos=jdbc.queryForList("select object_key from wish_photos p where p.id=? and p.couple_id=? and not exists(select 1 from wishes w where w.photo_id=p.id) and (p.upload_state='DELETING' or p.created_at<=current_timestamp-interval '24 hours') and not(p.upload_state='UPLOADING' and p.created_at>current_timestamp-interval '10 minutes')",String.class,id,scope);
        for(String object:photos){boolean imported=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from imported_wish_photos i join wish_photos p on p.id=i.id where i.id=? and i.object_key=? and p.object_key=i.object_key and p.couple_id=?)",Boolean.class,id,object,scope));if(!object.equals(key(scope,id))&&!imported)throw new IllegalStateException("Photo ownership could not be confirmed");storage.deleteObject(object);jdbc.update("delete from wish_photos where id=? and couple_id=? and not exists(select 1 from wishes where photo_id=?)",id,scope,id);}
    }
}
