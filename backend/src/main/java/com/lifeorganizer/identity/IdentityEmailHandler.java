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
    public IdentityEmailHandler(JdbcTemplate jdbc, SecretTokens tokens, JavaMailSender mail,
                               @Value("${app.public-url}") String publicUrl, @Value("${app.identity.mail-from}") String from) {
        this.jdbc=jdbc; this.tokens=tokens; this.mail=mail; this.publicUrl=publicUrl.replaceAll("/+$", ""); this.from=from;
        var uri=java.net.URI.create(publicUrl);
        if (uri.getHost()==null || !java.util.List.of("http","https").contains(uri.getScheme())) throw new IllegalArgumentException("Public URL must be an HTTP(S) origin");
    }
    public String kind() { return "IDENTITY_EMAIL"; }
    public void process(JobStore.Job job) {
        var actions=jdbc.query("select a.kind, u.email from identity_actions a join users u on u.id = a.user_id where a.id = ? and a.consumed_at is null and a.expires_at > current_timestamp and not u.deletion_requested and not exists(select 1 from deletion_markers d where d.user_id=u.id)", (r,n) -> java.util.Map.entry(r.getString("kind"),r.getString("email")),job.resourceId());
        if (actions.isEmpty()) return;
        var action=actions.getFirst(); boolean reset=action.getKey().equals("RESET");
        var message=new SimpleMailMessage(); message.setFrom(from); message.setTo(action.getValue());
        message.setSubject(reset ? "Réinitialisez votre mot de passe" : "Confirmez votre adresse e-mail");
        message.setText((reset ? "Pour choisir un nouveau mot de passe :\n" : "Pour confirmer votre adresse e-mail :\n") + publicUrl + (reset ? "/reset" : "/verify") + "#token=" + tokens.action(job.resourceId()) + "\n\nSi vous n'avez pas demandé ce message, ignorez-le.");
        mail.send(message);
    }
}
