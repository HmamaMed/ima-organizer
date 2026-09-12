package com.lifeorganizer.notes;

/**
 * Push delivery is tracked separately from the note's own delivery status — a
 * push failure must never cause the note itself to be resent or duplicated.
 */
public enum NotificationStatus {
    PENDING,
    SENT,
    FAILED
}
