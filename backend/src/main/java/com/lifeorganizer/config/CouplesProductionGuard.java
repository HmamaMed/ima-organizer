package com.lifeorganizer.config;

import com.lifeorganizer.media.R2Properties;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.*;
import org.springframework.core.env.*;
import java.net.URI;
import java.nio.file.*;
import java.util.*;

@Configuration @Profile("couples-production")
public class CouplesProductionGuard {
    private final Environment env;private final R2Properties storage;
    public CouplesProductionGuard(Environment env,R2Properties storage){this.env=env;this.storage=storage;}
    private String required(String key){String value=env.getProperty(key,"");if(value.isBlank())throw new IllegalStateException("Missing production configuration: "+key);return value;}
    @PostConstruct public void validate(){
        if(!env.acceptsProfiles(Profiles.of("couples")))throw new IllegalStateException("Production couples configuration requires the couples profile");
        URI publicUrl=URI.create(required("app.public-url"));
        if(!"https".equals(publicUrl.getScheme())||publicUrl.getHost()==null||List.of("localhost","127.0.0.1").contains(publicUrl.getHost()))throw new IllegalStateException("A public HTTPS origin is required");
        String runtime=required("spring.datasource.username"),migration=required("spring.flyway.user");
        if(runtime.equals(migration)||runtime.equals("postgres"))throw new IllegalStateException("Use separate migration and least-privilege runtime database roles");
        String jwt=required("app.jwt.secret"),actions=required("app.identity.token-secret");
        if(jwt.equals(actions)||jwt.length()<32||actions.length()<32||jwt.contains("dev-only")||actions.contains("dev-only"))throw new IllegalStateException("Provide distinct strong production signing secrets");
        if(!storage.configured()||!"https".equals(URI.create(storage.endpoint()).getScheme()))throw new IllegalStateException("Configure a dedicated private HTTPS media store");
        String mailHost=required("spring.mail.host");
        if(List.of("localhost","127.0.0.1").contains(mailHost)||(!env.getProperty("spring.mail.properties.mail.smtp.starttls.enable",Boolean.class,false)&&!env.getProperty("spring.mail.properties.mail.smtp.ssl.enable",Boolean.class,false)))throw new IllegalStateException("Configure a secure transactional SMTP provider");
        if(required("app.identity.mail-from").endsWith(".invalid"))throw new IllegalStateException("Configure a verified sender address");
        required("app.support-email");
        if(!Files.isReadable(Path.of(required("app.couples-firebase-path"))))throw new IllegalStateException("Configure a readable dedicated Firebase service account");
        if(!"validate".equals(env.getProperty("spring.jpa.hibernate.ddl-auto"))||!env.getProperty("spring.flyway.enabled",Boolean.class,false))throw new IllegalStateException("Production requires migrations and schema validation");
    }
}
