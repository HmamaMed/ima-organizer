package com.lifeorganizer.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import jakarta.annotation.*;
import java.io.*;

@Configuration
@Profile("couples")
public class CouplesFirebaseConfig {
    private final String path;
    private FirebaseApp app;
    public CouplesFirebaseConfig(@Value("${app.couples-firebase-path:}") String path) { this.path=path; }
    @PostConstruct public void initialize() throws IOException {
        if (path.isBlank()) return;
        try (var stream=new FileInputStream(path)) { app=FirebaseApp.initializeApp(FirebaseOptions.builder().setCredentials(GoogleCredentials.fromStream(stream)).build(),"couples"); }
    }
    @PreDestroy public void close() { if (app!=null) app.delete(); }
}
