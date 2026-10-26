package com.lifeorganizer.notes;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.couples.CoupleAccess;
import com.lifeorganizer.jobs.JobStore;
import jakarta.validation.constraints.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

@Service
@Profile("couples")
@Transactional(readOnly=true)
public class CoupleNoteService {
    private final JdbcTemplate jdbc;
    private final CoupleAccess access;
    private final JobStore jobs;
    private final com.lifeorganizer.notifications.PartnerNotifications notifications;
    public CoupleNoteService(JdbcTemplate jdbc, CoupleAccess access, JobStore jobs, com.lifeorganizer.notifications.PartnerNotifications notifications) { this.jdbc=jdbc;this.access=access;this.jobs=jobs;this.notifications=notifications; }
    public enum Mode { DRAFT, SEND, SCHEDULE }
    public record Input(@NotBlank @Size(max=4000) String content, @NotNull Mode mode, Instant scheduledFor) {}
    public record NoteView(UUID id,String content,String status,UUID senderId,String senderName,UUID recipientId,String recipientName,Instant scheduledFor,Instant sentAt,Instant createdAt) {}
    private final RowMapper<NoteView> mapper=(r,n)->new NoteView(r.getObject("id",UUID.class),r.getString("content"),r.getString("status"),r.getObject("sender_id",UUID.class),r.getString("sender_name"),r.getObject("recipient_id",UUID.class),r.getString("recipient_name"),r.getTimestamp("scheduled_for")==null?null:r.getTimestamp("scheduled_for").toInstant(),r.getTimestamp("sent_at")==null?null:r.getTimestamp("sent_at").toInstant(),r.getTimestamp("created_at").toInstant());
    private static final String SELECT="select n.*, s.name sender_name, r.name recipient_name from notes n join users s on s.id=n.sender_id left join users r on r.id=n.recipient_id ";
    private static final String VISIBLE="(n.status <> 'SENT' or n.sent_at > current_timestamp - interval '7 days')";
    public record Conversation(List<NoteView> messages,boolean hasMore,Instant nextBefore,UUID nextBeforeId) {}
    public Conversation conversation(User user,Instant before,UUID beforeId,int size) {
        UUID scope=access.requireScope(user);
        if ((before==null)!=(beforeId==null)) throw new IllegalArgumentException("Provide both conversation cursor values");
        int limit=Math.clamp(size,1,50);
        var parameters=new ArrayList<Object>(List.of(scope,user.getId(),user.getId()));
        String cursor="";
        if(before!=null) { cursor=" and (n.sent_at,n.id) < (?,?)"; parameters.add(Timestamp.from(before));parameters.add(beforeId); }
        parameters.add(limit+1);
        var batch=new ArrayList<>(jdbc.query(SELECT+"where n.couple_id=? and n.status='SENT' and "+VISIBLE+" and (n.sender_id=? or n.recipient_id=?)"+cursor+" order by n.sent_at desc,n.id desc limit ?",mapper,parameters.toArray()));
        boolean more=batch.size()>limit;
        if(more)batch.removeLast();
        NoteView oldest=batch.isEmpty()?null:batch.getLast();
        Collections.reverse(batch);
        return new Conversation(batch,more,oldest==null?null:oldest.sentAt(),oldest==null?null:oldest.id());
    }
    public List<NoteView> list(User user,String view,int page,int size) {
        UUID scope=access.requireScope(user);
        String filter=switch(view) { case "received"->"n.recipient_id = ? and n.status = 'SENT'"; case "sent"->"n.sender_id = ? and n.status = 'SENT'"; case "drafts"->"n.sender_id = ? and n.status in ('DRAFT','SCHEDULED')"; default->throw new IllegalArgumentException("Choose received, sent or drafts"); };
        return jdbc.query(SELECT+"where n.couple_id = ? and "+VISIBLE+" and "+filter+" order by n.created_at desc,n.id desc limit ? offset ?",mapper,scope,user.getId(),Math.clamp(size,1,100),Math.max(0,page)*(long)Math.clamp(size,1,100));
    }
    public NoteView get(User user,UUID id) {
        UUID scope=access.requireScope(user);
        return jdbc.query(SELECT+"where n.id = ? and n.couple_id = ? and "+VISIBLE+" and (n.sender_id = ? or (n.recipient_id = ? and n.status = 'SENT'))",mapper,id,scope,user.getId(),user.getId()).stream().findFirst().orElseThrow(()->new NoSuchElementException("Note not found"));
    }
    private UUID recipient(UUID scope,User user) {
        var recipients=jdbc.queryForList("select m.user_id from couple_memberships m join couples c on c.id=m.couple_id where m.couple_id = ? and m.user_id <> ? and m.left_at is null and c.status = 'ACTIVE'",UUID.class,scope,user.getId());
        if (recipients.size()!=1) throw new IllegalStateException("Pair with your partner before sending a note");
        return recipients.getFirst();
    }
    private void validateSchedule(UUID scope,User user,Input body,UUID excluded) {
        if (body.mode()!=Mode.SCHEDULE) return;
        if (body.scheduledFor()==null || !body.scheduledFor().isAfter(Instant.now()) || body.scheduledFor().isAfter(Instant.now().plusSeconds(366L*86400))) throw new IllegalArgumentException("Schedule a note between now and one year from now");
        Integer count=jdbc.queryForObject("select count(*) from notes where couple_id = ? and sender_id = ? and status = 'SCHEDULED' and (?::uuid is null or id <> ?)",Integer.class,scope,user.getId(),excluded,excluded);
        if (count!=null && count>=100) throw new IllegalStateException("You can have up to 100 scheduled notes");
    }
    @Transactional
    public NoteView create(User user,Input body,UUID requestId) {
        UUID scope=access.requireScopeForWrite(user);
        var previous=jdbc.queryForList("select id from notes where couple_id = ? and sender_id = ? and client_request_id = ?",UUID.class,scope,user.getId(),requestId);
        if (!previous.isEmpty()) return get(user,previous.getFirst());
        validateSchedule(scope,user,body,null);
        UUID recipient=body.mode()==Mode.DRAFT ? null : recipient(scope,user), id=UUID.randomUUID();
        String status=body.mode()==Mode.SEND?"SENT":body.mode()==Mode.SCHEDULE?"SCHEDULED":"DRAFT";
        Instant now=Instant.now();
        jdbc.update("insert into notes (id,couple_id,sender_id,recipient_id,client_request_id,content,status,scheduled_for,sent_at,created_at,notification_status) values (?,?,?,?,?,?,?,?,?,?,'PENDING')",id,scope,user.getId(),recipient,requestId,body.content().trim(),status,body.mode()==Mode.SCHEDULE?Timestamp.from(body.scheduledFor()):null,body.mode()==Mode.SEND?Timestamp.from(now):null,Timestamp.from(now));
        if (body.mode()==Mode.SCHEDULE) jobs.enqueue("NOTE_DELIVERY",id,scope,"note-delivery:"+id+":1",body.scheduledFor());
        if (body.mode()==Mode.SEND) notifications.publish(scope,user.getId(),recipient,"NOTE",id);
        return get(user,id);
    }
    @Transactional
    public NoteView update(User user,UUID id,Input body) {
        UUID scope=access.requireScopeForWrite(user);
        var versions=jdbc.queryForList("select delivery_version from notes where id = ? and couple_id = ? and sender_id = ? and status in ('DRAFT','SCHEDULED') for update",Integer.class,id,scope,user.getId());
        if (versions.isEmpty()) throw new NoSuchElementException("Editable note not found");
        validateSchedule(scope,user,body,id);
        UUID target=body.mode()==Mode.DRAFT?null:recipient(scope,user); int version=versions.getFirst()+1;
        String status=body.mode()==Mode.SEND?"SENT":body.mode()==Mode.SCHEDULE?"SCHEDULED":"DRAFT";
        jdbc.update("update notes set content = ?, status = ?, recipient_id = ?, scheduled_for = ?, sent_at = ?, delivery_version = ? where id = ? and couple_id = ?",body.content().trim(),status,target,body.mode()==Mode.SCHEDULE?Timestamp.from(body.scheduledFor()):null,body.mode()==Mode.SEND?Timestamp.from(Instant.now()):null,version,id,scope);
        if (body.mode()==Mode.SCHEDULE) jobs.enqueue("NOTE_DELIVERY",id,scope,"note-delivery:"+id+":"+version,body.scheduledFor());
        if (body.mode()==Mode.SEND) notifications.publish(scope,user.getId(),target,"NOTE",id);
        return get(user,id);
    }
    @Transactional
    public void cancel(User user,UUID id) {
        UUID scope=access.requireScopeForWrite(user);
        if (jdbc.update("update notes set status = 'CANCELLED' where id = ? and couple_id = ? and sender_id = ? and status in ('DRAFT','SCHEDULED')",id,scope,user.getId())==0) throw new NoSuchElementException("Editable note not found");
    }
    /** Couple lock is acquired before the note, matching request/disconnect order. */
    @Transactional
    public void deliver(UUID id,UUID couple) {
        jdbc.queryForList("select id from couples where id = ? for update",UUID.class,couple);
        var rows=jdbc.queryForList("select sender_id,recipient_id from notes where id = ? and couple_id = ? and status = 'SCHEDULED' and scheduled_for <= current_timestamp for update",id,couple);
        if (rows.isEmpty()) return;
        UUID sender=(UUID)rows.getFirst().get("sender_id"), recipient=(UUID)rows.getFirst().get("recipient_id");
        if (!notifications.currentPair(couple,sender,recipient)) { jdbc.update("update notes set status = 'CANCELLED' where id = ? and couple_id = ?",id,couple); return; }
        jdbc.update("update notes set status = 'SENT', sent_at = current_timestamp where id = ? and couple_id = ?",id,couple);
        notifications.publish(couple,sender,recipient,"NOTE",id);
    }
}
