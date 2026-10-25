package com.lifeorganizer.jobs;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("couples")
@ConditionalOnProperty(name="app.jobs.enabled", havingValue="true", matchIfMissing=true)
public class JobScheduler {
    private final JobRunner runner;
    public JobScheduler(JobRunner runner) { this.runner=runner; }
    @Scheduled(fixedDelayString="${app.jobs.delay-ms:5000}") public void run() { runner.runBatch(); }
}
