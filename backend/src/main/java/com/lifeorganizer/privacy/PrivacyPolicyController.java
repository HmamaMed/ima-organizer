package com.lifeorganizer.privacy;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.web.bind.annotation.*;

@RestController @Profile("couples")
public class PrivacyPolicyController {
    public record Policy(int temporaryMemoryHours,int closedSpaceRetentionDays,String supportEmail,boolean endToEndEncrypted,String accountDeletionPath,int sentNoteRetentionDays){}
    private final int days;private final String support;
    public PrivacyPolicyController(@Value("${app.privacy.closed-retention-days:30}")int days,@Value("${app.support-email:}")String support){this.days=days;this.support=support;}
    @GetMapping("/api/privacy/policy") public Policy policy(){return new Policy(72,days,support,false,"/delete-account",7);}
}
