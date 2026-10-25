package com.lifeorganizer.notes;

import com.lifeorganizer.jobs.*;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("couples")
public class NoteDeliveryHandler implements DurableJobHandler {
    private final CoupleNoteService notes;
    public NoteDeliveryHandler(CoupleNoteService notes) { this.notes=notes; }
    public String kind() { return "NOTE_DELIVERY"; }
    public void process(JobStore.Job job) { notes.deliver(job.resourceId(),job.coupleId()); }
}
