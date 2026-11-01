package com.lifeorganizer.identity;

import com.lifeorganizer.auth.InvalidCredentialsException;
import com.lifeorganizer.auth.JwtService;
import com.lifeorganizer.config.GlobalExceptionHandler;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class IdentitySessionControllerTests {
    final IdentityService identity = mock(IdentityService.class);
    final SessionStore sessions = mock(SessionStore.class);
    final AbuseLimiter limits = mock(AbuseLimiter.class);
    MockMvc mvc;
    @BeforeEach void setup() {
        mvc = MockMvcBuilders.standaloneSetup(new IdentityController(identity, sessions, limits, mock(JwtService.class),
                new BrowserSessions("https://between.example.test", "https://between.example.test")))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
    }
    @Test void nativeLoginStillReturnsTheRefreshTokenAndNeverCreatesACookie() throws Exception {
        when(identity.login(any())).thenReturn(new IdentityService.Credentials("access", "native-refresh", null));
        mvc.perform(post("/api/identity/login").contentType("application/json")
                .content("{\"email\":\"camille@example.test\",\"password\":\"correct-password\",\"deviceName\":\"phone\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.refreshToken").value("native-refresh"))
                .andExpect(header().doesNotExist("Set-Cookie")).andExpect(header().string("Cache-Control", "no-store"));
    }
    @Test void browserLoginDoesNotExposeItsRefreshTokenInTheResponseBody() throws Exception {
        when(identity.login(any())).thenReturn(new IdentityService.Credentials("access", "cookie-refresh", null));
        var result = mvc.perform(post("/api/identity/login").header("X-Session-Transport", "cookie")
                .header("Origin", "https://between.example.test").contentType("application/json")
                .content("{\"email\":\"camille@example.test\",\"password\":\"correct-password\",\"deviceName\":\"browser\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").value("access")).andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("cookie-refresh");
        assertThat(result.getResponse().getHeader("Set-Cookie")).contains("cookie-refresh", "HttpOnly", "Secure");
    }
    @Test void cookieRefreshNeedsNoRequestBodyAndRotatesTheCookie() throws Exception {
        when(identity.refresh("previous")).thenReturn(new IdentityService.Credentials("new-access", "rotated", null));
        var result = mvc.perform(post("/api/identity/refresh").header("X-Session-Transport", "cookie")
                .header("Origin", "https://between.example.test").contentType("application/json")
                .cookie(new Cookie(BrowserSessions.COOKIE, "previous")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.token").value("new-access")).andReturn();
        assertThat(result.getResponse().getHeader("Set-Cookie")).contains("rotated");
        assertThat(result.getResponse().getContentAsString()).doesNotContain("rotated");
        verify(identity).refresh("previous");
    }
    @Test void cookieRequestsFromOtherOriginsAreRejectedBeforeAuthenticationOrRevocation() throws Exception {
        for (String endpoint : new String[]{"refresh", "end-session"})
            mvc.perform(post("/api/identity/" + endpoint).header("X-Session-Transport", "cookie")
                    .header("Origin", "https://attacker.example.test").contentType("application/json")
                    .cookie(new Cookie(BrowserSessions.COOKIE, "secret"))).andExpect(status().isForbidden());
        verifyNoInteractions(identity);
    }
    @Test void invalidRefreshClearsTheCookieButServerOutagesPreserveIt() throws Exception {
        when(identity.refresh("expired")).thenThrow(new InvalidCredentialsException("Session expired"));
        when(identity.refresh("valid")).thenThrow(new DataAccessResourceFailureException("Unavailable"));
        var invalid = mvc.perform(post("/api/identity/refresh").header("X-Session-Transport", "cookie")
                .header("Origin", "https://between.example.test").contentType("application/json")
                .cookie(new Cookie(BrowserSessions.COOKIE, "expired"))).andExpect(status().isUnauthorized()).andReturn();
        assertThat(invalid.getResponse().getHeader("Set-Cookie")).contains("Max-Age=0");
        mvc.perform(post("/api/identity/refresh").header("X-Session-Transport", "cookie")
                .header("Origin", "https://between.example.test").contentType("application/json")
                .cookie(new Cookie(BrowserSessions.COOKIE, "valid"))).andExpect(status().isServiceUnavailable())
                .andExpect(header().doesNotExist("Set-Cookie"));
    }
    @Test void logoutRevokesTheRefreshSessionWithoutRequiringAnUnexpiredAccessToken() throws Exception {
        var result = mvc.perform(post("/api/identity/end-session").header("X-Session-Transport", "cookie")
                .header("Origin", "https://between.example.test").contentType("application/json")
                .cookie(new Cookie(BrowserSessions.COOKIE, "refresh"))).andExpect(status().isNoContent()).andReturn();
        verify(identity).endSession("refresh");
        assertThat(result.getResponse().getHeader("Set-Cookie")).contains("Max-Age=0");
        mvc.perform(post("/api/identity/end-session").contentType("application/json").content("{\"token\":\"native-refresh\"}"))
                .andExpect(status().isNoContent());
        verify(identity).endSession("native-refresh");
    }
}
