import com.lifeorganizer.identity.IdentityEmailTemplate;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

/** Run after Maven compile. Uses synthetic data and never connects to SMTP or a database. */
class PreviewEmails {
    public static void main(String[] args) throws Exception {
        Path output = Path.of(args.length == 0 ? "../artifacts/email-previews" : args[0]);
        Files.createDirectories(output);
        var renderer = new IdentityEmailTemplate();
        try (var mark = IdentityEmailTemplate.class.getResourceAsStream("/mail/between-us-mark.png")) {
            if (mark == null) throw new IllegalStateException("Missing email brand mark");
            Files.write(output.resolve("between-us-mark.png"), mark.readAllBytes());
        }
        StringBuilder cards = new StringBuilder();
        for (String language : new String[]{"fr", "en"}) for (String kind : new String[]{"VERIFY", "RESET"}) {
            String action = kind.equals("VERIFY") ? "verify" : "reset";
            String file = action + "-" + language;
            var rendered = renderer.render(kind, language, "Camille", "https://between-us.example/" + action + "#token=SYNTHETIC-PREVIEW-ONLY", Instant.parse("2030-01-15T18:30:00Z"));
            Files.writeString(output.resolve(file + ".html"), rendered.html().replace("cid:between-us-mark", "between-us-mark.png"), StandardCharsets.UTF_8);
            Files.writeString(output.resolve(file + ".txt"), rendered.plainText(), StandardCharsets.UTF_8);
            cards.append("<section><div class='label'><span>").append(language.equals("fr") ? "Français" : "English").append(" · ")
                    .append(action.equals("verify") ? "Verification" : "Password reset").append("</span><a href='").append(file)
                    .append(".html'>Open email ↗</a></div><iframe title='").append(file).append("' src='").append(file).append(".html'></iframe></section>");
        }
        Files.writeString(output.resolve("index.html"), """
            <!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Between Us · Email previews</title><style>
            *{box-sizing:border-box}body{margin:0;background:#eee9e7;color:#482541;font-family:Arial,sans-serif}
            header{max-width:1400px;margin:auto;padding:36px 24px 20px}h1{font:normal 36px Georgia,serif;margin:0 0 12px}
            p{color:#756570;line-height:1.6}button{cursor:pointer;padding:10px 18px;border:1px solid #482541;background:transparent;color:#482541;border-radius:8px}
            button[aria-pressed=true]{background:#482541;color:white}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;max-width:1400px;margin:auto;padding:0 24px 40px}
            section{min-width:0;background:#fff;border:1px solid #d8cdd5;border-radius:12px;overflow:hidden}.label{padding:15px;font-size:12px;display:flex;gap:12px;justify-content:space-between}a{color:#aa4566}
            iframe{display:block;width:100%;height:1000px;border:0;margin:auto;background:#f8f6f3}body.mobile iframe{max-width:360px;height:1120px}
            @media(max-width:850px){main{grid-template-columns:1fr;padding:0 12px 24px}header{padding:24px 16px}}
            </style><header><h1>A little care, in your inbox.</h1><p>Between Us · Verification and password-reset templates, in French and English.<br>Synthetic previews. The links are examples; no emails have been sent. Email-client rendering may vary.</p>
            <button aria-pressed="true" onclick="setWidth(false,this)">Desktop</button> <button aria-pressed="false" onclick="setWidth(true,this)">Mobile · 360px</button></header>
            <main>""" + cards + """
            </main><script>function setWidth(mobile,button){document.body.classList.toggle('mobile',mobile);document.querySelectorAll('button').forEach(item=>item.setAttribute('aria-pressed',String(item===button)))}</script></html>
            """, StandardCharsets.UTF_8);
        System.out.println("Email previews: " + output.resolve("index.html").toAbsolutePath());
    }
}
