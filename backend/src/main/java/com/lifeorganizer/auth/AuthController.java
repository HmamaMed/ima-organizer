package com.lifeorganizer.auth;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PutMapping("/push-token")
    public ResponseEntity<Void> updatePushToken(@AuthenticationPrincipal User user,
                                               @Valid @RequestBody PushTokenRequest request) {
        authService.updatePushToken(user.getId(), request.token());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/push-token")
    public ResponseEntity<Void> clearPushToken(@AuthenticationPrincipal User user) {
        authService.clearPushToken(user.getId());
        return ResponseEntity.noContent().build();
    }
}
