package com.lifeorganizer.identity;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;

class BrowserSessionsTests {
    final BrowserSessions sessions = new BrowserSessions("https://between.example.test", "http://localhost:5173,https://between.example.test");
    MockHttpServletRequest browser(String origin) {
        var request = new MockHttpServletRequest("POST", "/api/identity/refresh");
        request.addHeader("X-Session-Transport", "cookie");
        if (origin != null) request.addHeader("Origin", origin);
        request.setContentType("application/json");
        return request;
    }
    @Test void browserReceivesOnlyAnHttpOnlySecureRefreshCookie() {
        var request = browser("https://between.example.test"); var response = new MockHttpServletResponse();
        sessions.validate(request);
        var credentials = sessions.deliver(new IdentityService.Credentials("access", "refresh-secret", null), request, response);
        assertThat(credentials.token()).isEqualTo("access");
        assertThat(credentials.refreshToken()).isNull();
        assertThat(response.getHeader("Set-Cookie")).contains("between-us-session=refresh-secret", "HttpOnly", "Secure", "SameSite=Strict", "Path=/api/identity", "Max-Age=2592000");
        assertThat(response.getHeader("Cache-Control")).isEqualTo("no-store");
    }
    @Test void rejectsMissingAndUntrustedOriginsAndSimpleFormRequests() {
        for (String origin : new String[]{null, "null", "https://attacker.example.test", "https://between.example.test.attacker.test"})
            assertThatThrownBy(() -> sessions.validate(browser(origin))).isInstanceOf(AccessDeniedException.class);
        var form = browser("https://between.example.test"); form.setContentType("application/x-www-form-urlencoded");
        assertThatThrownBy(() -> sessions.validate(form)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void nativeClientsKeepTheExistingExplicitTokenTransport() {
        var request = new MockHttpServletRequest(); var response = new MockHttpServletResponse();
        sessions.validate(request);
        var credentials = new IdentityService.Credentials("access", "refresh-secret", null);
        assertThat(sessions.deliver(credentials, request, response)).isSameAs(credentials);
        assertThat(response.getHeader("Set-Cookie")).isNull();
    }
    @Test void readsOnlyTheSessionCookieAndClearsItWithMatchingAttributes() {
        var request = browser("http://localhost:5173"); sessions.validate(request);
        request.setCookies(new Cookie("unrelated", "ignore"), new Cookie(BrowserSessions.COOKIE, "refresh-secret"));
        assertThat(sessions.token(request)).isEqualTo("refresh-secret");
        var response = new MockHttpServletResponse(); sessions.clear(response);
        assertThat(response.getHeader("Set-Cookie")).contains("Max-Age=0", "Path=/api/identity", "HttpOnly", "Secure", "SameSite=Strict");
        var local = new BrowserSessions("http://localhost:5173", "http://localhost:5173"); var dev = new MockHttpServletResponse();
        local.clear(dev); assertThat(dev.getHeader("Set-Cookie")).doesNotContain("Secure");
    }
}
