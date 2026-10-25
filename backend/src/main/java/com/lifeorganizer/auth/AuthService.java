package com.lifeorganizer.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/**
 * Legacy username login. Public registration stays unavailable until the
 * commercial identity and isolation milestones are complete.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final boolean couplesMode;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService, Environment environment) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.couplesMode = environment.acceptsProfiles(Profiles.of("couples"));
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByName(request.username())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid username or password");
        }

        // Both accounts can receive their own private birthday reminders.
        if (!couplesMode && request.fcmToken() != null && !request.fcmToken().isBlank()) {
            assignPushToken(user, request.fcmToken());
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, user.getId(), user.getRole(), user.getName());
    }

    @Transactional
    public void updatePushToken(UUID userId, String token) {
        User user = userRepository.findById(userId).orElseThrow();
        assignPushToken(user, token);
    }

    private void assignPushToken(User user, String token) {
        // A shared phone must stop receiving the previous account's private reminders.
        for (User other : userRepository.findByFcmToken(token)) {
            if (!other.getId().equals(user.getId())) other.setFcmToken(null);
        }
        user.setFcmToken(token);
    }

    @Transactional
    public void clearPushToken(UUID userId) {
        userRepository.findById(userId).orElseThrow().setFcmToken(null);
    }
}
