package com.lifeorganizer.identity;

import com.lifeorganizer.jobs.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

@Component
@Profile("couples")
public class IdentityEmailHandler implements DurableJobHandler {
    private final JdbcTemplate jdbc;
    private final SecretTokens tokens;
    private final JavaMailSender mail;
    private final String publicUrl, from;
    private final AccountAccessPolicy access;
    public IdentityEmailHandler(JdbcTemplate jdbc, SecretTokens tokens, JavaMailSender mail,
                               @Value("${app.public-url}") String publicUrl, @Value("${app.identity.mail-from}") String from, AccountAccessPolicy access) {
        this.jdbc=jdbc; this.tokens=tokens; this.mail=mail; this.publicUrl=publicUrl.replaceAll("/+$", ""); this.from=from;
        this.access=access;
        var uri=java.net.URI.create(publicUrl);
        if (uri.getHost()==null || !java.util.List.of("http","https").contains(uri.getScheme())) throw new IllegalArgumentException("Public URL must be an HTTP(S) origin");
    }
    public String kind() { return "IDENTITY_EMAIL"; }
    private record Action(String kind,String email,String locale) {}
    public void process(JobStore.Job job) {
        if (!access.emailEnabled()) return;
        var actions=jdbc.query("select a.kind, u.email, u.locale from identity_actions a join users u on u.id = a.user_id where a.id = ? and a.consumed_at is null and a.expires_at > current_timestamp and not u.deletion_requested and not exists(select 1 from deletion_markers d where d.user_id=u.id)", (r,n) -> new Action(r.getString("kind"),r.getString("email"),r.getString("locale")),job.resourceId());
        if (actions.isEmpty()) return;
        var action=actions.getFirst(); boolean reset=action.kind().equals("RESET"),english="en".equals(action.locale());
        var message=new SimpleMailMessage(); message.setFrom(from); message.setTo(action.email());
        message.setSubject("Entre Nous — " + (english ? (reset ? "Reset your password" : "Confirm your email address") : (reset ? "Réinitialisez votre mot de passe" : "Confirmez votre adresse e-mail")));
        String introduction=english ? (reset ? "To choose a new password:\n" : "To confirm your email address:\n") : (reset ? "Pour choisir un nouveau mot de passe :\n" : "Pour confirmer votre adresse e-mail :\n");
        String footer=english ? "\n\nIf you did not request this message, ignore it." : "\n\nSi vous n'avez pas demandé ce message, ignorez-le.";
        String signature=english ? "Our words, our moments, our everyday life." : "Nos mots, nos moments, notre quotidien.";
        message.setText(introduction + publicUrl + (reset ? "/reset" : "/verify") + "#token=" + tokens.action(job.resourceId()) + footer + "\n\nEntre Nous\n" + signature);
        mail.send(message);
    }
}
