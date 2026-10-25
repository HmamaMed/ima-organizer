package com.lifeorganizer.identity;

import com.lifeorganizer.auth.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController
@Profile("couples")
@RequestMapping("/api/identity/devices")
public class DeviceController {
    private final JdbcTemplate jdbc;
    private final JwtService jwt;
    public DeviceController(JdbcTemplate jdbc,JwtService jwt) { this.jdbc=jdbc;this.jwt=jwt; }
    public record Device(@NotBlank @Size(max=1024) @Pattern(regexp="[\\x21-\\x7e]+") String token,@Pattern(regexp="ANDROID|WEB") String platform) {}
    @PostMapping @ResponseStatus(HttpStatus.NO_CONTENT) @Transactional
    public void register(@AuthenticationPrincipal User user,@Valid @RequestBody Device body,HttpServletRequest request) {
        UUID session=jwt.extractSessionId(request.getHeader("Authorization").substring(7));
        jdbc.update("update device_registrations set revoked_at=current_timestamp where fcm_token = ? and revoked_at is null",body.token());
        jdbc.update("insert into device_registrations (id,user_id,session_id,fcm_token,platform) values (?,?,?,?,?)",UUID.randomUUID(),user.getId(),session,body.token(),body.platform()==null?"ANDROID":body.platform());
    }
    @DeleteMapping @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@AuthenticationPrincipal User user,HttpServletRequest request) {
        jdbc.update("update device_registrations set revoked_at=current_timestamp where user_id=? and session_id=?",user.getId(),jwt.extractSessionId(request.getHeader("Authorization").substring(7)));
    }
}
