package com.lifeorganizer.identity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.time.Duration;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Cookies authenticate only the explicitly opted-in session endpoints, never ordinary API calls. */
@Component
@Profile("couples")
public class BrowserSessions {
    static final String COOKIE = "between-us-session";
    private final Set<String> origins;
    private final boolean secure;
    public BrowserSessions(@Value("${app.public-url}") String publicUrl,
                           @Value("${app.cors.allowed-origins}") String allowedOrigins) {
        URI url = URI.create(publicUrl);
        secure = "https".equalsIgnoreCase(url.getScheme());
        origins = new HashSet<>();
        Arrays.stream(allowedOrigins.split(",")).map(String::trim).filter(value -> !value.isEmpty()).forEach(origins::add);
        origins.add(url.getScheme() + "://" + url.getRawAuthority());
    }
    public boolean requested(HttpServletRequest request) {
        return "cookie".equals(request.getHeader("X-Session-Transport"));
    }
    public void validate(HttpServletRequest request) {
        if (!requested(request)) return;
        String origin = request.getHeader(HttpHeaders.ORIGIN);
        // CSRF protection for the cookie endpoints, including login/logout CSRF.
        if (origin == null || !origins.contains(origin) || "null".equals(origin))
            throw new AccessDeniedException("Untrusted session origin");
        try {
            if (request.getContentType() == null || !MediaType.APPLICATION_JSON.isCompatibleWith(MediaType.parseMediaType(request.getContentType())))
                throw new AccessDeniedException("Session requests require JSON");
        } catch (IllegalArgumentException invalid) { throw new AccessDeniedException("Session requests require JSON"); }
    }
    public String token(HttpServletRequest request) {
        if (request.getCookies() != null) for (var cookie : request.getCookies())
            if (COOKIE.equals(cookie.getName())) return cookie.getValue();
        return null;
    }
    public IdentityService.Credentials deliver(IdentityService.Credentials credentials, HttpServletRequest request, HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        if (!requested(request)) return credentials;
        cookie(response, credentials.refreshToken(), Duration.ofDays(30));
        // The browser must never receive the refresh token in JavaScript-readable JSON.
        return new IdentityService.Credentials(credentials.token(), null, credentials.user());
    }
    public void clear(HttpServletResponse response) { cookie(response, "", Duration.ZERO); }
    private void cookie(HttpServletResponse response, String value, Duration age) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(COOKIE, value)
                .httpOnly(true).secure(secure).sameSite("Strict").path("/api/identity").maxAge(age).build().toString());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
    }
}
