package com.lifeorganizer.config;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Loads a {@code .env} file from the working directory (or the backend project
 * root) into the Spring environment so the app works whether it is launched
 * from a terminal, an IDE, or a container — without requiring the developer to
 * manually {@code source .env} first.
 *
 * Real environment variables always take precedence over values from the file.
 */
public class EnvFileEnvironmentPostProcessor implements EnvironmentPostProcessor {

    private static final String PROPERTY_SOURCE_NAME = "dotenv";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment,
                                       SpringApplication application) {
        Path envFile = findEnvFile();
        if (envFile == null) {
            return;
        }

        Map<String, Object> props = new LinkedHashMap<>();
        try {
            for (String line : Files.readAllLines(envFile)) {
                String trimmed = line.trim();
                if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                    continue;
                }
                int eq = trimmed.indexOf('=');
                if (eq <= 0) {
                    continue;
                }
                String key = trimmed.substring(0, eq).trim();
                String value = trimmed.substring(eq + 1).trim();
                // Strip surrounding quotes.
                if (value.length() >= 2
                        && ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.substring(1, value.length() - 1);
                }
                props.put(key, value);
            }
        } catch (IOException e) {
            // Ignore — the app should still boot without a .env file.
            return;
        }

        if (props.isEmpty()) {
            return;
        }

        MutablePropertySources sources = environment.getPropertySources();
        // Add last so real env vars / system properties still win.
        sources.addLast(new MapPropertySource(PROPERTY_SOURCE_NAME, props));
    }

    private Path findEnvFile() {
        String cwd = System.getProperty("user.dir");
        if (cwd != null) {
            // 1. Working directory (e.g. backend/ when run from the backend folder)
            Path inCwd = Path.of(cwd, ".env");
            if (Files.exists(inCwd)) {
                return inCwd;
            }
            // 2. A backend/ subfolder of the working directory (e.g. when the
            //    IDE runs from the repo root)
            Path inBackend = Path.of(cwd, "backend", ".env");
            if (Files.exists(inBackend)) {
                return inBackend;
            }
        }
        return null;
    }

}
