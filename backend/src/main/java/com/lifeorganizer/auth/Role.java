package com.lifeorganizer.auth;

/**
 * The only two roles that will ever exist in this app.
 * OWNER = the person who curates content (dashboard).
 * RECIPIENT = the person who consumes it (feed, timeline, workouts).
 */
public enum Role {
    OWNER,
    RECIPIENT
}
