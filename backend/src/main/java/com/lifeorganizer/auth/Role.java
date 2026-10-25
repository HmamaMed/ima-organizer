package com.lifeorganizer.auth;

/**
 * Legacy personal-app permissions; couple membership grants equal partner access.
 * OWNER = the person who curates content (dashboard).
 * RECIPIENT = the person who consumes it (feed, timeline, workouts).
 */
public enum Role {
    OWNER,
    MEMBER,
    RECIPIENT
}
