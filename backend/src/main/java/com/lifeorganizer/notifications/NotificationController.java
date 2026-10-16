package com.lifeorganizer.notifications;

import com.lifeorganizer.auth.User;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {
    private final BirthdayNotificationRepository notifications;
    public NotificationController(BirthdayNotificationRepository notifications) { this.notifications = notifications; }

    public record NotificationResponse(UUID id, String title, String body, Instant createdAt) {
        static NotificationResponse from(BirthdayNotification notification) {
            return new NotificationResponse(notification.getId(), notification.getTitle(),
                    notification.getBody(), notification.getCreatedAt());
        }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<NotificationResponse> list(@AuthenticationPrincipal User user) {
        return notifications.findByUserIdAndDismissedFalseOrderByCreatedAtDescIdDesc(user.getId())
                .stream().map(NotificationResponse::from).toList();
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void delete(@AuthenticationPrincipal User user, @PathVariable UUID id) {
        if (notifications.dismiss(id, user.getId()) == 0) throw new NoSuchElementException("Notification not found.");
    }
}
