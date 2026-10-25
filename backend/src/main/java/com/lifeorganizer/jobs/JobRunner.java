package com.lifeorganizer.jobs;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;
import java.util.*;

/** Claims commit before provider I/O. Lease tokens prevent an expired worker from completing another claim. */
@Service
@Profile("couples")
public class JobRunner {
    private final JobStore jobs;
    private final Map<String, DurableJobHandler> handlers = new HashMap<>();
    public JobRunner(JobStore jobs, List<DurableJobHandler> handlers) { this.jobs=jobs; handlers.forEach(h -> this.handlers.put(h.kind(),h)); }
    public void runBatch() {
        for (int i=0; i<50; i++) {
            var next=jobs.claim(); if (next.isEmpty()) return;
            var job=next.get();
            try {
                var handler=handlers.get(job.kind());
                if (handler==null) throw new IllegalStateException("Unknown job kind");
                handler.process(job); jobs.complete(job);
            } catch (RuntimeException failure) { jobs.retry(job); }
        }
    }
}
