package com.lifeorganizer.jobs;

public interface DurableJobHandler {
    String kind();
    void process(JobStore.Job job);
}
