package com.lifeorganizer.auth;

import com.lifeorganizer.identity.SessionStore;
import io.jsonwebtoken.MalformedJwtException;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.Optional;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtAuthenticationFilterTests {
    final JwtService jwt=mock(JwtService.class);
    final UserRepository users=mock(UserRepository.class);
    final SessionStore sessions=mock(SessionStore.class);
    final FilterChain chain=mock(FilterChain.class);
    final MockHttpServletRequest request=new MockHttpServletRequest("GET","/api/identity/me");
    final MockHttpServletResponse response=new MockHttpServletResponse();
    JwtAuthenticationFilter filter;

    @BeforeEach void setup() {
        SecurityContextHolder.clearContext();
        var env=new MockEnvironment();env.setActiveProfiles("couples");
        @SuppressWarnings("unchecked") ObjectProvider<SessionStore> provider=mock(ObjectProvider.class);
        when(provider.getObject()).thenReturn(sessions);
        filter=new JwtAuthenticationFilter(jwt,users,provider,env);
        request.addHeader("Authorization","Bearer token");
    }
    @AfterEach void clearContext() { SecurityContextHolder.clearContext(); }

    void validToken(UUID id,UUID session) {
        User user=mock(User.class);
        when(user.getId()).thenReturn(id);
        when(user.getRole()).thenReturn(Role.MEMBER);
        when(jwt.extractUserId("token")).thenReturn(id);
        when(jwt.extractSessionId("token")).thenReturn(session);
        when(jwt.isValid("token",user)).thenReturn(true);
        when(users.findById(id)).thenReturn(Optional.of(user));
    }

    @Test void databaseFailureReturns503WithoutPretendingTheTokenIsInvalid() throws Exception {
        UUID id=UUID.randomUUID(),session=UUID.randomUUID();validToken(id,session);
        when(sessions.active(session,id)).thenThrow(new DataAccessResourceFailureException("Database unavailable"));
        filter.doFilter(request,response,chain);
        assertThat(response.getStatus()).isEqualTo(503);
        assertThat(response.getContentAsString()).contains("Service temporarily unavailable").doesNotContain("Database unavailable");
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verifyNoInteractions(chain);
    }
    @Test void malformedTokenContinuesWithoutAuthentication() throws Exception {
        when(jwt.extractUserId("token")).thenThrow(new MalformedJwtException("Invalid token"));
        filter.doFilter(request,response,chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNull();
        verify(chain).doFilter(request,response);
    }
    @Test void activeSessionStillAuthenticatesNormally() throws Exception {
        UUID id=UUID.randomUUID(),session=UUID.randomUUID();validToken(id,session);
        when(sessions.active(session,id)).thenReturn(true);
        filter.doFilter(request,response,chain);
        assertThat(SecurityContextHolder.getContext().getAuthentication()).isNotNull();
        verify(chain).doFilter(request,response);
    }
}
