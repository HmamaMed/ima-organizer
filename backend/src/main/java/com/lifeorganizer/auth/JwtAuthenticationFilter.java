package com.lifeorganizer.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.dao.DataAccessException;
import org.springframework.web.filter.OncePerRequestFilter;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Reads the Bearer token from each request, validates it, and populates the
 * SecurityContext with the authenticated user if valid.
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final org.springframework.beans.factory.ObjectProvider<com.lifeorganizer.identity.SessionStore> sessions;
    private final boolean couplesMode;
    private final JwtService jwtService;
    private final UserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserRepository userRepository, org.springframework.beans.factory.ObjectProvider<com.lifeorganizer.identity.SessionStore> sessions, org.springframework.core.env.Environment environment) {
        this.jwtService = jwtService;
        this.sessions = sessions;
        couplesMode = environment.acceptsProfiles(org.springframework.core.env.Profiles.of("couples"));
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        String token = header.substring(7);
        try {
            UUID userId = jwtService.extractUserId(token);
            Optional<User> userOpt = userRepository.findById(userId);
            if (userOpt.isPresent() && jwtService.isValid(token, userOpt.get())
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                User user = userOpt.get();
                boolean active = !couplesMode || (!user.isDeletionRequested() && jwtService.extractSessionId(token) != null
                        && sessions.getObject().active(jwtService.extractSessionId(token), user.getId()));
                if (active) {
                    var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
                    var authToken = new UsernamePasswordAuthenticationToken(user, null, authorities);
                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                }
            }
        } catch (DataAccessException unavailable) {
            log.error("Database lookup failed during request authentication", unavailable);
            SecurityContextHolder.clearContext();
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType("application/json");
            response.setHeader("Retry-After", "5");
            response.getWriter().write("{\"status\":503,\"message\":\"Service temporarily unavailable. Please try again.\"}");
            return;
        } catch (JwtException | IllegalArgumentException ignored) {
            // Invalid token — leave the context unauthenticated.
        }

        filterChain.doFilter(request, response);
    }
}
