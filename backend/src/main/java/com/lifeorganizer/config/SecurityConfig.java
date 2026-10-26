package com.lifeorganizer.config;

import com.lifeorganizer.auth.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

/**
 * Stateless JWT security. The login endpoint is public; everything else under
 * /api requires a valid Bearer token. The couples profile exposes only scoped
 * modules; the personal deployment retains controller-level legacy roles.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final boolean couplesMode;

    @Value("${app.cors.allowed-origins}")
    private List<String> allowedOrigins;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, Environment environment) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.couplesMode = environment.acceptsProfiles(Profiles.of("couples"));
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // Without this, Spring Security's default fallback returns 403 for both
                // "no/invalid token" and "valid token, wrong role" — the client can't
                // tell "log in again" apart from "you're not allowed to do this".
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(unauthorizedEntryPoint())
                        .accessDeniedHandler(forbiddenHandler()))
                .authorizeHttpRequests(auth -> {
                    if (couplesMode) {
                        auth.requestMatchers(HttpMethod.GET, "/api/identity/config").permitAll();
                        auth.requestMatchers(HttpMethod.GET, "/", "/home", "/join", "/verify", "/reset", "/delete-account", "/privacy",
                                "/profile", "/notes", "/memories", "/watchlist", "/recipes", "/wishes", "/inbox", "/birthdays", "/notifications",
                                "/index.html", "/assets/**", "/fonts/**", "/favicon.ico", "/favicon.svg", "/favicon-*.png", "/icon.svg").permitAll();
                        auth.requestMatchers(HttpMethod.HEAD, "/", "/index.html", "/assets/**").permitAll();
                        auth.requestMatchers(HttpMethod.GET, "/api/privacy/policy").permitAll();
                        auth.requestMatchers(HttpMethod.POST, "/api/identity/register", "/api/identity/login", "/api/identity/refresh",
                                "/api/identity/verification-email", "/api/identity/password-email", "/api/identity/verify", "/api/identity/reset-password").permitAll();
                        // Deny unfinished modules, uploads and unknown routes even for authenticated members.
                        auth.requestMatchers("/api/identity/me", "/api/identity/language", "/api/identity/reauthenticate", "/api/identity/logout", "/api/identity/logout-all",
                                "/api/birthdays", "/api/birthdays/**", "/api/notifications", "/api/notifications/**", "/api/recipes", "/api/recipes/**", "/api/wishes", "/api/wishes/**", "/api/privacy/**", "/api/identity/devices", "/api/couples", "/api/couples/**", "/api/watchlist", "/api/watchlist/**",
                                "/api/notes", "/api/notes/**", "/api/memories", "/api/memories/groups", "/api/memories/groups/*",
                                "/api/memories/groups/*/media", "/api/memories/*", "/api/inbox", "/api/inbox/**").authenticated()
                                .anyRequest().denyAll();
                    } else {
                        auth.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll();
                        auth.requestMatchers("/api/**").authenticated().anyRequest().permitAll();
                    }
                })
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    private AuthenticationEntryPoint unauthorizedEntryPoint() {
        return (request, response, authException) -> response.sendError(401, "Unauthorized");
    }

    private AccessDeniedHandler forbiddenHandler() {
        return (request, response, accessDeniedException) -> response.sendError(403, "Forbidden");
    }

    private CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(allowedOrigins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept-Language", "Idempotency-Key", "X-Couple-Id"));

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public org.springframework.security.core.userdetails.UserDetailsService userDetailsService() {
        return username -> { throw new org.springframework.security.core.userdetails.UsernameNotFoundException("Use token authentication"); };
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
