package com.lifeorganizer.identity;

import org.junit.jupiter.api.Test;
import java.time.Instant;
import static org.assertj.core.api.Assertions.*;

class IdentityEmailTemplateTests {
    final IdentityEmailTemplate template = new IdentityEmailTemplate();
    final Instant expiry = Instant.parse("2030-01-15T18:30:00Z");
    @Test void verificationAndResetUseLocalizedCopyWithTheRealExpiryAndPlainTextFallback() {
        for (String language : new String[]{"en", "fr"}) for (String kind : new String[]{"VERIFY", "RESET"}) {
            String url = "https://between.example.test/" + (kind.equals("VERIFY") ? "verify" : "reset") + "#token=secret";
            var email = template.render(kind, language, "Camille", url, expiry);
            assertThat(email.html()).contains("lang=\"" + language + "\"", "cid:between-us-mark", "Camille", url, "18:30 UTC").doesNotContain("{{");
            assertThat(email.plainText()).contains(url, "Camille", "18:30 UTC").doesNotContain("<html", "cid:");
            assertThat(email.language()).isEqualTo(language);
            if (language.equals("en")) {
                assertThat(email.subject()).isEqualTo("Between Us — " + (kind.equals("RESET") ? "Reset your password" : "Confirm your email address"));
                assertThat(email.html()).contains("January 15, 2030");
            } else {
                assertThat(email.subject()).isEqualTo("Between Us — " + (kind.equals("RESET") ? "Réinitialisez votre mot de passe" : "Confirmez votre adresse e-mail"));
                assertThat(email.html()).contains("15 janvier 2030");
            }
        }
    }
    @Test void namesAndUrlsAreEscapedAndUserInputCannotIntroduceTemplateSubstitutions() {
        String name = "Camille <script>alert(1)</script> & {{button}}";
        var email = template.render("VERIFY", "en", name, "https://between.example.test/verify?one=1&two=2#token=secret", expiry);
        assertThat(email.html()).contains("&lt;script&gt;alert(1)&lt;/script&gt; &amp; {{button}}", "one=1&amp;two=2")
                .doesNotContain("<script>", "one=1&two=2");
        assertThat(email.plainText()).contains(name, "one=1&two=2");
    }
    @Test void resetExplainsThatIgnoringTheEmailDoesNotChangeThePassword() {
        var email = template.render("RESET", "en", null, "https://between.example.test/reset#token=secret", expiry);
        assertThat(email.html()).contains("Hello,", "Your password will stay the same.");
        assertThat(email.plainText()).contains("Your password will stay the same.");
        assertThat(template.render("VERIFY", "fr", "", "https://between.example.test/verify", expiry).html()).contains("Bonjour,");
    }
    @Test void rejectsUnknownActionsAndNonWebLinks() {
        assertThatThrownBy(() -> template.render("UNKNOWN", "en", "Camille", "https://between.example.test", expiry)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> template.render("RESET", "en", "Camille", "javascript:alert(1)", expiry)).isInstanceOf(IllegalArgumentException.class);
    }
}
