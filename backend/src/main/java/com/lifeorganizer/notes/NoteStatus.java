package com.lifeorganizer.notes;

/**
 * Lifecycle of a note.
 * <ul>
 *   <li>DRAFT — being written, not yet scheduled or sent.</li>
 *   <li>SCHEDULED — has a future {@code scheduledFor}, waiting for the scheduler.</li>
 *   <li>SENT — delivered to the recipient (and push fired).</li>
 * </ul>
 */
public enum NoteStatus {
    DRAFT,
    SCHEDULED,
    SENT
}
