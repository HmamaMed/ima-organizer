package com.lifeorganizer.privacy;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.identity.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@Profile("couples")
@RequestMapping("/api/privacy")
public class PrivacyController {
    private final PrivacyService privacy;
    private final SessionStore sessions;
    private final JwtService jwt;
    private final AbuseLimiter limits;
    public PrivacyController(PrivacyService privacy,SessionStore sessions,JwtService jwt,AbuseLimiter limits) { this.privacy=privacy;this.sessions=sessions;this.jwt=jwt;this.limits=limits; }
    private void recent(User user,HttpServletRequest request) { sessions.requireRecent(jwt.extractSessionId(request.getHeader("Authorization").substring(7)),user.getId()); }
    @PostMapping("/deletion") @ResponseStatus(HttpStatus.ACCEPTED) public Map<String,UUID> delete(@AuthenticationPrincipal User user,HttpServletRequest request) { recent(user,request);return Map.of("requestId",privacy.requestDeletion(user)); }
    @GetMapping("/export") public ResponseEntity<Map<String,Object>> export(@AuthenticationPrincipal User user,HttpServletRequest request) {
        recent(user,request);limits.check("export:"+user.getId(),3,3600);
        return ResponseEntity.ok().header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=entre-nous-export.json").cacheControl(CacheControl.noStore()).body(privacy.export(user));
    }
    @PostMapping("/reports") @ResponseStatus(HttpStatus.ACCEPTED) public void report(@AuthenticationPrincipal User user,@Valid @RequestBody PrivacyService.Report body,HttpServletRequest request) {
        limits.check("report:"+user.getId(),5,3600);if(body.kind()==PrivacyService.Report.Kind.UNWANTED_PARTNER)recent(user,request);privacy.report(user,body);
    }
}
