package com.lifeorganizer.identity;

import com.lifeorganizer.auth.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@Profile("couples")
@RequestMapping("/api/identity")
public class IdentityController {
    private final IdentityService identity;
    private final SessionStore sessions;
    private final AbuseLimiter limits;
    private final JwtService jwt;
    public IdentityController(IdentityService identity, SessionStore sessions, AbuseLimiter limits, JwtService jwt) { this.identity=identity; this.sessions=sessions; this.limits=limits; this.jwt=jwt; }
    private void limit(HttpServletRequest request, String action, String email, int perEmail) {
        limits.check(action + ":ip:" + request.getRemoteAddr(), 50, 900);
        limits.check(action + ":email:" + IdentityService.normalize(email), perEmail, 900);
    }
    @PostMapping("/register") @ResponseStatus(HttpStatus.ACCEPTED)
    public void register(@Valid @RequestBody IdentityService.Register body, HttpServletRequest request) { limit(request,"register",body.email(),5); identity.register(body); }
    @PostMapping("/login")
    public IdentityService.Credentials login(@Valid @RequestBody IdentityService.Login body, HttpServletRequest request) { limit(request,"login",body.email(),10); return identity.login(body); }
    @PostMapping("/refresh")
    public IdentityService.Credentials refresh(@Valid @RequestBody IdentityService.TokenInput body, HttpServletRequest request) { limits.check("refresh:"+request.getRemoteAddr(),100,900); return identity.refresh(body.token()); }
    @PostMapping("/verification-email") @ResponseStatus(HttpStatus.ACCEPTED)
    public void resend(@Valid @RequestBody IdentityService.EmailInput body, HttpServletRequest request) { limit(request,"email",body.email(),3); identity.emailAction(body.email(),"VERIFY"); }
    @PostMapping("/password-email") @ResponseStatus(HttpStatus.ACCEPTED)
    public void forgot(@Valid @RequestBody IdentityService.EmailInput body, HttpServletRequest request) { limit(request,"email",body.email(),3); identity.emailAction(body.email(),"RESET"); }
    @PostMapping("/verify") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void verify(@Valid @RequestBody IdentityService.TokenInput body, HttpServletRequest request) { limits.check("verify:"+request.getRemoteAddr(),30,900); identity.verify(body.token()); }
    @PostMapping("/reset-password") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reset(@Valid @RequestBody IdentityService.Reset body, HttpServletRequest request) { limits.check("reset:"+request.getRemoteAddr(),30,900); identity.reset(body); }
    @GetMapping("/config") public IdentityService.Configuration configuration() { return identity.configuration(); }
    @GetMapping("/me") public IdentityService.Account me(@AuthenticationPrincipal User user) { return identity.account(user); }
    @PutMapping("/me") public IdentityService.Account settings(@AuthenticationPrincipal User user, @Valid @RequestBody IdentityService.Settings body) { return identity.settings(user,body); }
    public UUID session(HttpServletRequest request) { return jwt.extractSessionId(request.getHeader("Authorization").substring(7)); }
    @PostMapping("/reauthenticate") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void reauthenticate(@AuthenticationPrincipal User user, @Valid @RequestBody IdentityService.PasswordInput body, HttpServletRequest request) { limit(request,"reauth",user.getId().toString(),10); identity.reauthenticate(user,session(request),body.password()); }
    @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal User user, HttpServletRequest request) { sessions.revoke(session(request),user.getId()); }
    @PostMapping("/logout-all") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logoutAll(@AuthenticationPrincipal User user) { sessions.revokeAll(user.getId()); }
}
