package com.lifeorganizer.push;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.User;
import com.lifeorganizer.auth.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Proof-of-concept endpoint for step 3: sends ONE hardcoded test push to the
 * recipient's device so we can verify the whole Firebase pipeline end to end
 * before building any module UI on top of it.
 */
@RestController
@RequestMapping("/api/push")
public class PushController {

    private final PushService pushService;
    private final UserRepository userRepository;

    public PushController(PushService pushService, UserRepository userRepository) {
        this.pushService = pushService;
        this.userRepository = userRepository;
    }

    @PostMapping("/test")
    public ResponseEntity<Map<String, Object>> sendTestPush() {
        User recipient = userRepository.findByRole(Role.RECIPIENT)
                .orElseThrow(() -> new IllegalStateException("Recipient user not seeded"));

        boolean sent = pushService.sendToUser(
                recipient,
                "Life Organizer",
                "This is a test push — the pipeline works! 💌");

        return ResponseEntity.ok(Map.of(
                "sent", sent,
                "recipient", recipient.getName()));
    }
}
