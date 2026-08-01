package com.lifeorganizer.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.io.FileInputStream;
import java.io.IOException;

/**
 * Initializes the Firebase Admin SDK from the service account JSON file.
 *
 * The file path comes from {@code firebase.service-account-path} (default
 * {@code ./firebase-service-account.json}). Keep that file out of git — load it
 * via an environment variable or a gitignored local file.
 */
@Configuration
public class FirebaseConfig {

    private static final Logger log = LoggerFactory.getLogger(FirebaseConfig.class);

    private final String serviceAccountPath;

    public FirebaseConfig(@Value("${firebase.service-account-path}") String serviceAccountPath) {
        this.serviceAccountPath = serviceAccountPath;
    }

    @PostConstruct
    public void initialize() {
        // Avoid double-initialization if the app context is refreshed.
        if (FirebaseApp.getApps().stream().anyMatch(app -> app.getName().equals(FirebaseApp.DEFAULT_APP_NAME))) {
            return;
        }

        try (FileInputStream serviceAccount = new FileInputStream(serviceAccountPath)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .build();
            FirebaseApp.initializeApp(options);
            log.info("Firebase Admin SDK initialized from {}", serviceAccountPath);
        } catch (IOException e) {
            // The app should still boot without Firebase so local dev without a
            // service account file isn't blocked; pushes will simply fail.
            log.warn("Firebase Admin SDK not initialized ({}). Push notifications will be unavailable.",
                    e.getMessage());
        }
    }
}
