package com.lifeorganizer.notifications;

import com.lifeorganizer.auth.User;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@Profile("couples")
@RequestMapping("/api/inbox")
public class PartnerNotificationController {
    private final PartnerNotifications notifications;
    public PartnerNotificationController(PartnerNotifications notifications) { this.notifications=notifications; }
    @GetMapping public List<PartnerNotifications.Notification> inbox(@AuthenticationPrincipal User user,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) { return notifications.inbox(user,page,size); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void dismiss(@AuthenticationPrincipal User user,@PathVariable UUID id) { notifications.dismiss(user,id); }
    @GetMapping("/preferences") public PartnerNotifications.Preferences preferences(@AuthenticationPrincipal User user) { return notifications.preferences(user); }
    @PutMapping("/preferences") public PartnerNotifications.Preferences preferences(@AuthenticationPrincipal User user,@RequestBody PartnerNotifications.Preferences body) { return notifications.preferences(user,body); }
}
