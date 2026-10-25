package com.lifeorganizer.config;

import com.lifeorganizer.auth.User;
import com.lifeorganizer.identity.AccountAccessPolicy;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import static org.assertj.core.api.Assertions.*;

class AccountAccessPolicyTests {
    User user(String email) { return new User(email,"Partner","hash","fr","Africa/Casablanca"); }
    @Test void approvedPrivateAccountNeedsNoEmailButRemainsUnverified() {
        var access=new AccountAccessPolicy(false," OWNER@EXAMPLE.TEST , recipient@example.test ");
        var account=user("owner@example.test");
        assertThat(access.requiresEmailVerification(account)).isFalse();
        assertThatCode(()->access.requireVerified(account)).doesNotThrowAnyException();
        assertThat(account.isEmailVerified()).isFalse();
        assertThatThrownBy(access::requireEmailDelivery).isInstanceOf(AccessDeniedException.class);
    }
    @Test void privateAccessRejectsOtherAccountsEvenWhenVerified() {
        var access=new AccountAccessPolicy(false,"owner@example.test");
        var other=user("other@example.test");other.verifyEmail();
        assertThat(access.allowsAccount(other.getEmail())).isFalse();
        assertThat(access.allowsAccount(null)).isFalse();
        assertThatThrownBy(()->access.requireVerified(other)).isInstanceOf(AccessDeniedException.class);
    }
    @Test void enablingEmailRestoresRealVerificationForPrivateAccountsToo() {
        var access=new AccountAccessPolicy(true,"owner@example.test");
        var account=user("owner@example.test");
        assertThat(access.requiresEmailVerification(account)).isTrue();
        assertThatThrownBy(()->access.requireVerified(account)).isInstanceOf(AccessDeniedException.class);
        account.verifyEmail();
        assertThatCode(()->access.requireVerified(account)).doesNotThrowAnyException();
    }
}
