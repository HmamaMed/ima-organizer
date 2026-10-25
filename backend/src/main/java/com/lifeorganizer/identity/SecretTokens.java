package com.lifeorganizer.identity;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

@Component
@Profile("couples")
public class SecretTokens {
    private final byte[] actionKey;
    private final SecureRandom random = new SecureRandom();
    public SecretTokens(@Value("${app.identity.token-secret}") String secret) {
        actionKey = secret.getBytes(StandardCharsets.UTF_8);
        if (actionKey.length < 32) throw new IllegalArgumentException("Identity token secret must be at least 32 bytes");
    }
    public String random() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    public static String hash(String token) {
        if (token == null || token.length() > 512) throw new IllegalArgumentException("Invalid token");
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
        catch (GeneralSecurityException impossible) { throw new IllegalStateException(impossible); }
    }
    /** Durable email jobs regenerate the token from a random challenge ID; the database stores only its hash. */
    public String action(UUID id) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(actionKey, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(("identity:" + id).getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException impossible) { throw new IllegalStateException(impossible); }
    }
}
