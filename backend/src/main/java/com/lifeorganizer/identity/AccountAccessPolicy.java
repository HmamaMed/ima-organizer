package com.lifeorganizer.identity;

import com.lifeorganizer.auth.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;
import java.util.*;
import java.util.stream.Collectors;

/** Private access is approved by the operator; email ownership is not claimed to be verified. */
@Component
@Profile("couples")
public class AccountAccessPolicy {
    private final boolean emailEnabled;
    private final Set<String> privateAccounts;
    public AccountAccessPolicy(@Value("${app.identity.email-enabled:true}") boolean emailEnabled,
                               @Value("${app.identity.private-account-emails:}") String privateAccounts) {
        this.emailEnabled = emailEnabled;
        this.privateAccounts = Arrays.stream(privateAccounts.split(",")).map(String::trim)
            .filter(value -> !value.isEmpty()).map(value -> value.toLowerCase(Locale.ROOT)).collect(Collectors.toUnmodifiableSet());
    }
    public boolean emailEnabled() { return emailEnabled; }
    public boolean allowsAccount(String email) {
        return emailEnabled || email != null && privateAccounts.contains(email.trim().toLowerCase(Locale.ROOT));
    }
    public boolean requiresEmailVerification(User user) { return emailEnabled || !allowsAccount(user.getEmail()); }
    public void requireEmailDelivery() {
        if (!emailEnabled) throw new AccessDeniedException("Email account actions are not available right now");
    }
    public void requireVerified(User user) {
        if (user.isDeletionRequested() || !allowsAccount(user.getEmail()) || (!user.isEmailVerified() && requiresEmailVerification(user)))
            throw new AccessDeniedException("Verify your email before pairing");
    }
}
