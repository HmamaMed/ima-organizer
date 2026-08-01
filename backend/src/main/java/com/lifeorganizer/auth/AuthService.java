package com.lifeorganizer.auth;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

/**
 * Handles login. There is deliberately no registration — the two users are
 * seeded directly in the database.
 */
@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByName(request.username())
                .orElseThrow(() -> new InvalidCredentialsException("Invalid username or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException("Invalid username or password");
        }

        // Persist the recipient's push token on login so the backend can reach
        // her device. (OWNER may also set one, but it's not required.)
        if (request.fcmToken() != null && !request.fcmToken().isBlank()) {
            user.setFcmToken(request.fcmToken());
            userRepository.save(user);
        }

        String token = jwtService.generateToken(user);
        return new LoginResponse(token, user.getId(), user.getRole(), user.getName());
    }
}
