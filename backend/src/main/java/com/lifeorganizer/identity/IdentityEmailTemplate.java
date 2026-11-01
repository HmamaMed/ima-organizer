package com.lifeorganizer.identity;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** A shared email layout and localized account-action copy, independent of the SMTP provider. */
public final class IdentityEmailTemplate {
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{([a-zA-Z]+)}}");
    private final String layout;

    public IdentityEmailTemplate() {
        try (var resource = IdentityEmailTemplate.class.getResourceAsStream("/mail/identity.html")) {
            if (resource == null) throw new IllegalStateException("Missing account email template");
            layout = new String(resource.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException failure) { throw new UncheckedIOException("Could not read account email template", failure); }
    }

    public record Rendered(String subject, String plainText, String html, String language) {}

    public Rendered render(String kind, String locale, String name, String actionUrl, Instant expiresAt) {
        if (!"VERIFY".equals(kind) && !"RESET".equals(kind)) throw new IllegalArgumentException("Unsupported account email");
        URI url = URI.create(actionUrl);
        if (url.getHost() == null || !("https".equals(url.getScheme()) || "http".equals(url.getScheme())))
            throw new IllegalArgumentException("Account email links must use HTTP(S)");
        boolean reset = "RESET".equals(kind), english = "en".equals(locale);
        String language = english ? "en" : "fr";
        String subject = "Between Us — " + (english ? (reset ? "Reset your password" : "Confirm your email address")
                : (reset ? "Réinitialisez votre mot de passe" : "Confirmez votre adresse e-mail"));
        String preheader = english ? (reset ? "Choose a new password and return to your space." : "One little step to your space together.")
                : (reset ? "Choisissez un nouveau mot de passe pour retrouver votre espace." : "Un petit pas avant votre espace à deux.");
        String eyebrow = english ? (reset ? "PASSWORD RESET" : "WELCOME TO YOUR SPACE")
                : (reset ? "VOTRE MOT DE PASSE" : "BIENVENUE DANS VOTRE ESPACE");
        String heading = english ? (reset ? "Back to your little world." : "A little space. Just for you two.")
                : (reset ? "Retrouvons votre espace." : "Un petit espace. Rien qu’à vous deux.");
        String safeName = name == null ? "" : name.strip();
        String greeting = (english ? "Hello" : "Bonjour") + (safeName.isEmpty() ? "," : " " + safeName + ",");
        String introduction = english
                ? (reset ? "You asked to reset your password. Choose a new one to return to your Between Us space."
                         : "Confirm your email address to start sharing your words, your moments, and your everyday life together.")
                : (reset ? "Vous avez demandé à changer votre mot de passe. Choisissez-en un nouveau pour retrouver votre espace Between Us."
                         : "Confirmez votre adresse e-mail pour commencer à partager vos mots, vos moments et votre quotidien à deux.");
        String button = english ? (reset ? "Choose a new password" : "Confirm my email")
                : (reset ? "Choisir un nouveau mot de passe" : "Confirmer mon adresse");
        var formatter = DateTimeFormatter.ofPattern(english ? "MMMM d, uuuu 'at' HH:mm 'UTC'" : "d MMMM uuuu 'à' HH:mm 'UTC'", english ? Locale.ENGLISH : Locale.FRENCH)
                .withZone(ZoneOffset.UTC);
        String expiry = (english ? "This link expires on " : "Ce lien expire le ") + formatter.format(expiresAt) + ".";
        String safety = english ? "If you didn’t request this email, you can safely ignore it." : "Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail.";
        if (reset) safety += english ? " Your password will stay the same." : " Votre mot de passe restera inchangé.";
        String fallback = english ? "Button not working? Copy this link into your browser:" : "Le bouton ne fonctionne pas ? Copiez ce lien dans votre navigateur :";
        String signature = english ? "Our words, our moments, our everyday life." : "Nos mots, nos moments, notre quotidien.";
        Map<String, String> values = Map.ofEntries(
                Map.entry("language", language), Map.entry("subject", subject), Map.entry("preheader", preheader),
                Map.entry("eyebrow", eyebrow), Map.entry("heading", heading), Map.entry("greeting", greeting),
                Map.entry("introduction", introduction), Map.entry("button", button), Map.entry("expiry", expiry),
                Map.entry("safety", safety), Map.entry("fallback", fallback), Map.entry("signature", signature), Map.entry("actionUrl", actionUrl));
        // One replacement pass: user-supplied text can never introduce another template placeholder.
        String html = PLACEHOLDER.matcher(layout).replaceAll(match -> {
            String value = values.get(match.group(1));
            if (value == null) throw new IllegalStateException("Unknown account email placeholder");
            return Matcher.quoteReplacement(escape(value));
        });
        String plain = String.join("\n\n", "Between Us", greeting, introduction, button + ":\n" + actionUrl, expiry, safety, signature);
        return new Rendered(subject, plain, html, language);
    }

    private static String escape(String text) {
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;");
    }
}
