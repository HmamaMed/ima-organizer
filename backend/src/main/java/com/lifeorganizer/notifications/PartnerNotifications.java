package com.lifeorganizer.notifications;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.couples.CoupleAccess;
import com.lifeorganizer.jobs.JobStore;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

@Service
@Profile("couples")
@Transactional(readOnly=true)
public class PartnerNotifications {
    private final JdbcTemplate jdbc;
    private final JobStore jobs;
    private final CoupleAccess access;
    public PartnerNotifications(JdbcTemplate jdbc,JobStore jobs,CoupleAccess access) { this.jdbc=jdbc;this.jobs=jobs;this.access=access; }
    public boolean currentPair(UUID couple,UUID sender,UUID recipient) {
        if (sender==null || recipient==null || sender.equals(recipient)) return false;
        Integer count=jdbc.queryForObject("select count(*) from couple_memberships m join couples c on c.id=m.couple_id join users u on u.id=m.user_id where m.couple_id = ? and m.user_id in (?,?) and m.left_at is null and c.status = 'ACTIVE' and not u.deletion_requested and not exists(select 1 from deletion_markers d where d.user_id=u.id)",Integer.class,couple,sender,recipient);
        return count!=null && count==2;
    }
    public Optional<UUID> other(UUID couple,UUID creator) {
        return jdbc.queryForList("select m.user_id from couple_memberships m join couples c on c.id=m.couple_id join users u on u.id=m.user_id where m.couple_id = ? and m.user_id <> ? and m.left_at is null and c.status = 'ACTIVE' and not u.deletion_requested and not exists(select 1 from deletion_markers d where d.user_id=u.id)",UUID.class,couple,creator).stream().findFirst();
    }
    @Transactional
    public void publish(UUID couple,UUID sender,UUID recipient,String kind,UUID resource) {
        if (!currentPair(couple,sender,recipient)) return;
        jdbc.update("insert into partner_notifications (id,couple_id,author_id,recipient_id,kind,resource_id) values (?,?,?,?,?,?) on conflict(recipient_id,kind,resource_id) do nothing",UUID.randomUUID(),couple,sender,recipient,kind,resource);
        UUID id=jdbc.queryForObject("select id from partner_notifications where recipient_id = ? and kind = ? and resource_id = ?",UUID.class,recipient,kind,resource);
        jobs.enqueue("PARTNER_PUSH",id,couple,"partner-push:"+id,Instant.now());
    }
    public record Notification(UUID id,String kind,UUID resourceId,String authorName,Instant createdAt) {}
    public List<Notification> inbox(User user,int page,int size) {
        UUID scope=access.requireScope(user);
        return jdbc.query("""
            select p.*,u.name from partner_notifications p join users u on u.id=p.author_id
            where p.recipient_id = ? and p.couple_id = ? and not p.dismissed and (
                (p.kind = 'NOTE' and exists(select 1 from notes n where n.id=p.resource_id and n.couple_id=p.couple_id and n.status='SENT' and n.sent_at > current_timestamp - interval '7 days')) or
                (p.kind = 'MEMORY' and exists(select 1 from memories m join memory_groups g on g.id=m.group_id where m.id=p.resource_id and m.couple_id=p.couple_id and m.deleted_at is null and g.deleted_at is null and g.expires_at > current_timestamp)))
            order by p.created_at desc,p.id desc limit ? offset ?
            """,(r,n)->new Notification(r.getObject("id",UUID.class),r.getString("kind"),r.getObject("resource_id",UUID.class),r.getString("name"),r.getTimestamp("created_at").toInstant()),user.getId(),scope,Math.clamp(size,1,100),Math.max(page,0)*(long)Math.clamp(size,1,100));
    }
    @Transactional public void dismiss(User user,UUID id) {
        UUID scope=access.requireScopeForWrite(user);
        if (jdbc.update("update partner_notifications set dismissed = true where id = ? and couple_id = ? and recipient_id = ?",id,scope,user.getId())==0) throw new NoSuchElementException("Notification not found");
    }
    public record Preferences(boolean notesEnabled,boolean memoriesEnabled,boolean previewsEnabled) {}
    public Preferences preferences(User user) {
        return jdbc.query("select * from notification_preferences where user_id = ?",(r,n)->new Preferences(r.getBoolean("notes_enabled"),r.getBoolean("memories_enabled"),r.getBoolean("previews_enabled")),user.getId()).stream().findFirst().orElse(new Preferences(true,true,false));
    }
    @Transactional public Preferences preferences(User user,Preferences body) {
        jdbc.update("insert into notification_preferences (user_id,notes_enabled,memories_enabled,previews_enabled) values (?,?,?,?) on conflict(user_id) do update set notes_enabled=excluded.notes_enabled, memories_enabled=excluded.memories_enabled, previews_enabled=excluded.previews_enabled",user.getId(),body.notesEnabled(),body.memoriesEnabled(),body.previewsEnabled());return body;
    }
}
