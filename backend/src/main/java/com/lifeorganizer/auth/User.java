package com.lifeorganizer.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/**
 * An account exists independently of couple membership. Legacy roles remain
 * for the personal deployment while commercial identity is implemented.
 */
@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String passwordHash;

    /** Last registered device push token for this account. Nullable. */
    @Column
    private String fcmToken;

    @Column(length = 320) private String email;
    @Column(nullable = false, columnDefinition = "boolean default false") private boolean emailVerified;
    @Column(nullable = false, columnDefinition = "boolean default false") private boolean deletionRequested;
    @Column(length = 20) private String locale = "fr";
    @Column(length = 100) private String timeZone = "UTC";

    public String getEmail() { return email; }
    public boolean isEmailVerified() { return emailVerified; }
    public boolean isDeletionRequested() { return deletionRequested; }
    public String getLocale() { return locale; }
    public String getTimeZone() { return timeZone; }
    public void verifyEmail() { emailVerified = true; }
    public void requestDeletion() { deletionRequested = true; fcmToken = null; }
    public void changePassword(String hash) { passwordHash = hash; }
    public void changeLanguage(String locale) { this.locale = locale; }
    public void updateSettings(String displayName, String locale, String zone) {
        java.time.ZoneId.of(zone);
        name = displayName.trim(); this.locale = locale; timeZone = zone;
    }
    public User(String email, String displayName, String hash, String locale, String zone) {
        this(Role.MEMBER, displayName.trim(), hash);
        this.email = email; updateSettings(displayName, locale, zone);
    }

    protected User() {
        // for JPA
    }

    public User(Role role, String name, String passwordHash) {
        this.role = role;
        this.name = name;
        this.passwordHash = passwordHash;
    }

    public UUID getId() {
        return id;
    }

    public Role getRole() {
        return role;
    }

    public String getName() {
        return name;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public String getFcmToken() {
        return fcmToken;
    }

    public void setFcmToken(String fcmToken) {
        this.fcmToken = fcmToken;
    }
}
