package com.lifeorganizer.birthdays;

import com.lifeorganizer.jobs.*;
import com.lifeorganizer.notifications.DevicePushService;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.*;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service @Profile("couples")
public class CoupleBirthdayJobs {
    private final JdbcTemplate jdbc;private final JobStore jobs;
    public CoupleBirthdayJobs(JdbcTemplate jdbc,JobStore jobs){this.jdbc=jdbc;this.jobs=jobs;}
    public void scan(){UUID cursor=null;while(true){var batch=jdbc.queryForList("select id from birthday_reminders where (?::uuid is null or id>?) order by id limit 100",UUID.class,cursor,cursor);if(batch.isEmpty())return;for(UUID id:batch)planner().plan(id,Instant.now());cursor=batch.getLast();}}
    // Calls go through a Spring proxy so each reminder has its own short transaction.
    @org.springframework.beans.factory.annotation.Autowired private org.springframework.beans.factory.ObjectProvider<CoupleBirthdayJobs> self;
    private CoupleBirthdayJobs planner(){return self.getObject();}
    @Transactional public void plan(UUID id,Instant now){
        var reminders=jdbc.queryForList("select b.*,u.locale from birthday_reminders b join users u on u.id=b.user_id where b.id=? and not u.deletion_requested and u.email_verified and not exists(select 1 from deletion_markers d where d.user_id=u.id) for update of b",id);if(reminders.isEmpty())return;var row=reminders.getFirst();
        ZonedDateTime local=now.atZone(ZoneId.of((String)row.get("time_zone")));if(local.getHour()<19)return;
        LocalDate birthday=BirthdayDates.nextOccurrence((Integer)row.get("birthday_month"),(Integer)row.get("birthday_day"),local.toLocalDate());int days=(int)ChronoUnit.DAYS.between(local.toLocalDate(),birthday);if(days!=1&&days!=3)return;
        UUID user=(UUID)row.get("user_id");boolean english="en".equals(row.get("locale"));String title=english?"A birthday is coming up":"Un anniversaire approche";String body=english?"“"+row.get("label")+"” is in "+days+(days==1?" day.":" days."):"« "+row.get("label")+" » : dans "+days+(days==1?" jour.":" jours.");UUID notification=UUID.randomUUID();
        jdbc.update("insert into birthday_notifications(id,user_id,reminder_id,birthday_date,days_before,title,body,created_at,dismissed) values (?,?,?,?,?,?,?,current_timestamp,false) on conflict(reminder_id,birthday_date,days_before) do nothing",notification,user,id,birthday,days,title,body);
        UUID actual=jdbc.queryForObject("select id from birthday_notifications where reminder_id=? and birthday_date=? and days_before=?",UUID.class,id,birthday,days);
        jobs.enqueue("BIRTHDAY_PUSH",actual,null,"birthday-push:"+actual,Instant.now());
    }
    @Component @Profile("couples") @ConditionalOnProperty(name="app.jobs.enabled",havingValue="true",matchIfMissing=true)
    public static class Scanner {
        private final CoupleBirthdayJobs jobs;public Scanner(CoupleBirthdayJobs jobs){this.jobs=jobs;}
        @Scheduled(fixedDelayString="${app.birthdays.scan-ms:300000}") public void scan(){jobs.scan();}
    }
    @Component @Profile("couples") public static class Push implements DurableJobHandler {
        private final JdbcTemplate jdbc;private final DevicePushService devices;public Push(JdbcTemplate jdbc,DevicePushService devices){this.jdbc=jdbc;this.devices=devices;}
        public String kind(){return "BIRTHDAY_PUSH";}
        public void process(JobStore.Job job){var rows=jdbc.queryForList("select n.*,u.locale,coalesce(p.previews_enabled,false) previews from birthday_notifications n join users u on u.id=n.user_id left join notification_preferences p on p.user_id=u.id where n.id=? and not n.dismissed and not u.deletion_requested",job.resourceId());if(rows.isEmpty())return;var row=rows.getFirst();boolean english="en".equals(row.get("locale"));devices.send((UUID)row.get("user_id"),english?"A birthday is coming up":"Un anniversaire approche",Boolean.TRUE.equals(row.get("previews"))?(String)row.get("body"):(english?"One of your personal reminders is coming up.":"Un de vos rappels personnels approche."),"/notifications",Map.of());}
    }
}
