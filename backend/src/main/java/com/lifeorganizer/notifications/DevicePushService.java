package com.lifeorganizer.notifications;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.*;

@Service @Profile("couples")
public class DevicePushService {
    private final JdbcTemplate jdbc;public DevicePushService(JdbcTemplate jdbc){this.jdbc=jdbc;}
    public void send(UUID user,String title,String body,String route,Map<String,String> data){
        var devices=jdbc.queryForList("select d.fcm_token from device_registrations d join refresh_sessions s on s.id=d.session_id join users u on u.id=d.user_id where d.user_id=? and d.revoked_at is null and s.user_id=d.user_id and s.revoked_at is null and s.expires_at>current_timestamp and not u.deletion_requested and not exists(select 1 from deletion_markers m where m.user_id=u.id)",String.class,user);
        if(devices.isEmpty())return;
        if(FirebaseApp.getApps().stream().noneMatch(app->app.getName().equals("couples")))throw new IllegalStateException("Push provider unavailable");
        for(String token:devices){
            boolean active=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from device_registrations d join refresh_sessions s on s.id=d.session_id where d.user_id=? and d.fcm_token=? and d.revoked_at is null and s.revoked_at is null and s.expires_at>current_timestamp and not exists(select 1 from deletion_markers m where m.user_id=d.user_id))",Boolean.class,user,token));if(!active)continue;
            try{FirebaseMessaging.getInstance(FirebaseApp.getInstance("couples")).send(Message.builder().setToken(token).setNotification(Notification.builder().setTitle(title).setBody(body).build()).putAllData(data).putData("route",route).build());}
            catch(FirebaseMessagingException failure){if(failure.getMessagingErrorCode()==MessagingErrorCode.UNREGISTERED)jdbc.update("update device_registrations set revoked_at=current_timestamp where user_id=? and fcm_token=?",user,token);else throw new IllegalStateException("Push delivery failed");}
        }
    }
}
