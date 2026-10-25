package com.lifeorganizer.couples;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.identity.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@Profile("couples")
@RequestMapping("/api/couples")
public class CoupleController {
    private final CoupleService couples;
    private final SessionStore sessions;
    private final JwtService jwt;
    private final AbuseLimiter limits;
    public CoupleController(CoupleService couples, SessionStore sessions, JwtService jwt, AbuseLimiter limits) { this.couples=couples;this.sessions=sessions;this.jwt=jwt;this.limits=limits; }
    public record InviteInput(@Email @Size(max=320) String email) {}
    @GetMapping("/current") public CoupleService.Space current(@AuthenticationPrincipal User user) { return couples.current(user); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public CoupleService.Space create(@AuthenticationPrincipal User user) { return couples.create(user); }
    @PostMapping("/invitations") @ResponseStatus(HttpStatus.CREATED)
    public CoupleService.Invitation invite(@AuthenticationPrincipal User user,@Valid @RequestBody InviteInput body) { limits.check("invite:"+user.getId(),10,3600);return couples.invite(user,body.email()); }
    @PostMapping("/invitations/preview")
    public CoupleService.Preview preview(@AuthenticationPrincipal User user,@Valid @RequestBody IdentityService.TokenInput body) { limits.check("invitation-lookup:"+user.getId(),30,900);return couples.preview(user,body.token()); }
    @PostMapping("/invitations/accept") public CoupleService.Space accept(@AuthenticationPrincipal User user,@Valid @RequestBody IdentityService.TokenInput body) { limits.check("invitation-accept:"+user.getId(),10,900);return couples.accept(user,body.token()); }
    @DeleteMapping("/invitations") @ResponseStatus(HttpStatus.NO_CONTENT) public void revoke(@AuthenticationPrincipal User user) { couples.revokeInvitation(user); }
    @PostMapping("/disconnect") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void disconnect(@AuthenticationPrincipal User user,HttpServletRequest request) { sessions.requireRecent(jwt.extractSessionId(request.getHeader("Authorization").substring(7)),user.getId());couples.disconnect(user); }
}
