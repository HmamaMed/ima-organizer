package com.lifeorganizer.couples;

import com.lifeorganizer.auth.User;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;
import java.util.*;

/** Reject a request composed in an earlier relationship, including authentication-refresh replays. */
@Configuration
@Profile("couples")
public class CoupleRequestScope implements WebMvcConfigurer {
    private final JdbcTemplate jdbc;
    public CoupleRequestScope(JdbcTemplate jdbc) { this.jdbc=jdbc; }
    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request,HttpServletResponse response,Object handler) {
                String expected=request.getHeader("X-Couple-Id");
                if (expected==null) return true;
                Object principal=SecurityContextHolder.getContext().getAuthentication().getPrincipal();
                if (!(principal instanceof User user)) return true;
                UUID scope;
                try { scope=UUID.fromString(expected); } catch (IllegalArgumentException invalid) { throw new IllegalArgumentException("Invalid couple context"); }
                boolean current=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from couple_memberships m join couples c on c.id=m.couple_id where m.user_id=? and m.couple_id=? and m.left_at is null and c.status<>'CLOSED')",Boolean.class,user.getId(),scope));
                if (!current) throw new IllegalStateException("Your couple has changed. Reopen your space before trying again.");
                return true;
            }
        }).addPathPatterns("/api/notes/**","/api/watchlist/**","/api/memories/**","/api/inbox/**","/api/recipes/**","/api/wishes/**");
    }
}
