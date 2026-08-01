package com.lifeorganizer.seed;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.User;
import com.lifeorganizer.auth.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Seeds the two and only two users on startup if they don't already exist.
 * There is no public registration flow — these are the only accounts, ever.
 *
 * Credentials come from configuration (environment variables in production,
 * defaults in application.yml for local dev).
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SeedProperties properties;

    public DataSeeder(UserRepository userRepository,
                      PasswordEncoder passwordEncoder,
                      SeedProperties properties) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    public void run(String... args) {
        seedUser(Role.OWNER, properties.ownerUsername(), properties.ownerPassword());
        seedUser(Role.RECIPIENT, properties.recipientUsername(), properties.recipientPassword());
    }

    private void seedUser(Role role, String username, String password) {
        if (userRepository.findByRole(role).isPresent()) {
            return;
        }
        User user = new User(role, username, passwordEncoder.encode(password));
        userRepository.save(user);
        log.info("Seeded {} user '{}'", role, username);
    }
}
