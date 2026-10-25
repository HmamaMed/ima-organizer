package com.lifeorganizer.notifications;

import com.lifeorganizer.jobs.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.*;

@Component
@Profile("couples")
public class PartnerPushHandler implements DurableJobHandler {
    private final JdbcTemplate jdbc;
    private final PartnerNotifications notifications;
    private final DevicePushService devices;
    public PartnerPushHandler(JdbcTemplate jdbc,PartnerNotifications notifications,DevicePushService devices) { this.jdbc=jdbc;this.notifications=notifications;this.devices=devices; }
    public String kind() { return "PARTNER_PUSH"; }
    public void process(JobStore.Job job) {
        var rows=jdbc.queryForList("select * from partner_notifications where id=? and couple_id=? and not dismissed",job.resourceId(),job.coupleId());
        if (rows.isEmpty()) return;
        var row=rows.getFirst(); UUID author=(UUID)row.get("author_id"),recipient=(UUID)row.get("recipient_id");
        if (!notifications.currentPair(job.coupleId(),author,recipient)) return;
        String kind=(String)row.get("kind"); UUID resource=(UUID)row.get("resource_id");
        var prefs=jdbc.queryForList("select * from notification_preferences where user_id=?",recipient);
        boolean previews=!prefs.isEmpty() && Boolean.TRUE.equals(prefs.getFirst().get("previews_enabled"));
        if (!prefs.isEmpty() && !Boolean.TRUE.equals(prefs.getFirst().get(kind.equals("NOTE")?"notes_enabled":"memories_enabled"))) return;
        String body=kind.equals("NOTE")?"Votre partenaire vous a laissé une note.":"Votre partenaire a partagé un moment.";
        if (kind.equals("MEMORY")) {
            Integer visible=jdbc.queryForObject("select count(*) from memories m join memory_groups g on g.id=m.group_id where m.id=? and m.couple_id=? and m.deleted_at is null and g.deleted_at is null and g.expires_at>current_timestamp",Integer.class,resource,job.coupleId());
            if (visible==null || visible==0) return;
        }
        if (previews) {
            String text=kind.equals("NOTE")?jdbc.queryForObject("select content from notes where id=? and couple_id=? and status='SENT'",String.class,resource,job.coupleId()):jdbc.queryForObject("select caption from memories where id=? and couple_id=?",String.class,resource,job.coupleId());
            if (text!=null && !text.isBlank()) body=text.substring(0,Math.min(text.length(),100));
        }
        if (notifications.currentPair(job.coupleId(),author,recipient)) devices.send(recipient,kind.equals("NOTE")?"Un mot pour vous":"Un moment à deux",body,kind.equals("NOTE")?"/notes":"/memories",Map.of("coupleId",job.coupleId().toString()));
    }
}
