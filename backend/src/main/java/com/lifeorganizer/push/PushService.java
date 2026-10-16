package com.lifeorganizer.push;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.Notification;
import com.lifeorganizer.auth.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import java.util.Map;

/**
 * Sends push notifications via the Firebase Admin SDK.
 *
 * If Firebase isn't initialized (no service account file present) or the target
 * user has no fcmToken, the send is skipped with a warning rather than failing
 * the caller — pushes are best-effort.
 */
@Service
public class PushService {

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    /**
     * Sends a notification to a single user's registered device token.
     *
     * @return true if the message was accepted by FCM, false if it was skipped
     *         (no token, or Firebase not initialized).
     */
    public boolean sendToUser(User user, String title, String body) {
        return sendToUser(user, title, body, Map.of());
    }

    public boolean sendToUser(User user, String title, String body, Map<String, String> data) {
        if (user.getFcmToken() == null || user.getFcmToken().isBlank()) {
            log.warn("No fcmToken for user '{}' — skipping push", user.getName());
            return false;
        }
        return sendToToken(user.getFcmToken(), title, body, data);
    }

    /**
     * Sends a notification to a raw device token.
     */
    public boolean sendToToken(String token, String title, String body) {
        return sendToToken(token, title, body, Map.of());
    }

    private boolean sendToToken(String token, String title, String body, Map<String, String> data) {
        if (FirebaseApp.getApps().isEmpty()) {
            log.warn("Firebase not initialized — skipping push to token");
            return false;
        }

        Message message = Message.builder()
                .setToken(token)
                .putAllData(data)
                .setNotification(Notification.builder()
                        .setTitle(title)
                        .setBody(body)
                        .build())
                .build();

        try {
            String messageId = FirebaseMessaging.getInstance().send(message);
            log.info("Push sent (messageId={})", messageId);
            return true;
        } catch (FirebaseMessagingException e) {
            log.error("Failed to send push: {}", e.getMessage(), e);
            return false;
        }
    }
}
