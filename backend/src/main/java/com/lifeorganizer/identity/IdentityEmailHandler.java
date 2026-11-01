package com.lifeorganizer.identity;

import com.lifeorganizer.jobs.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailPreparationException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import jakarta.mail.MessagingException;
import java.time.Instant;

@Component
@Profile("couples")
public class IdentityEmailHandler implements DurableJobHandler {
    private final JdbcTemplate jdbc;
    private final SecretTokens tokens;
    private final JavaMailSender mail;
    private final String publicUrl, from;
    private final AccountAccessPolicy access;
    private final IdentityEmailTemplate template = new IdentityEmailTemplate();
    public IdentityEmailHandler(JdbcTemplate jdbc, SecretTokens tokens, JavaMailSender mail,
                               @Value("${app.public-url}") String publicUrl, @Value("${app.identity.mail-from}") String from, AccountAccessPolicy access) {
        this.jdbc=jdbc; this.tokens=tokens; this.mail=mail; this.publicUrl=publicUrl.replaceAll("/+$", ""); this.from=from;
        this.access=access;
        var uri=java.net.URI.create(publicUrl);
        if (uri.getHost()==null || !java.util.List.of("http","https").contains(uri.getScheme())) throw new IllegalArgumentException("Public URL must be an HTTP(S) origin");
    }
    public String kind() { return "IDENTITY_EMAIL"; }
    private record Action(String kind,String email,String locale,String name,Instant expiresAt) {}
    public void process(JobStore.Job job) {
        if (!access.emailEnabled()) return;
        var actions=jdbc.query("select a.kind, u.email, u.locale, u.name, a.expires_at from identity_actions a join users u on u.id = a.user_id where a.id = ? and a.consumed_at is null and a.expires_at > current_timestamp and not u.deletion_requested and not exists(select 1 from deletion_markers d where d.user_id=u.id)", (r,n) -> new Action(r.getString("kind"),r.getString("email"),r.getString("locale"),r.getString("name"),r.getTimestamp("expires_at").toInstant()),job.resourceId());
        if (actions.isEmpty()) return;
        var action=actions.getFirst();
        String actionUrl=publicUrl + (action.kind().equals("RESET") ? "/reset" : "/verify") + "#token=" + tokens.action(job.resourceId());
        var rendered=template.render(action.kind(),action.locale(),action.name(),actionUrl,action.expiresAt());
        try {
            var message=mail.createMimeMessage();
            var helper=new MimeMessageHelper(message,MimeMessageHelper.MULTIPART_MODE_RELATED,"UTF-8");
            helper.setFrom(from); helper.setTo(action.email()); helper.setSubject(rendered.subject());
            helper.setText(rendered.plainText(),rendered.html());
            helper.addInline("between-us-mark",new ClassPathResource("mail/between-us-mark.png"),"image/png");
            message.setHeader("Content-Language",rendered.language());
            mail.send(message);
        } catch (MessagingException failure) { throw new MailPreparationException("Could not prepare account email",failure); }
    }
}
