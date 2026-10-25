package com.lifeorganizer.couples;

import com.lifeorganizer.auth.User;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Slots control capacity; both members have the same permissions. */
@Entity
@Table(name = "couple_memberships")
public class CoupleMembership {
    @Id @GeneratedValue private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "couple_id", nullable = false, updatable = false) private Couple couple;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, updatable = false) private User user;
    @Column(nullable = false, updatable = false) private int slot;
    @Column(nullable = false, updatable = false) private Instant joinedAt;
    private Instant leftAt;

    protected CoupleMembership() {}
    public CoupleMembership(Couple couple, User user, int slot, Instant now) {
        if (slot != 1 && slot != 2) throw new IllegalArgumentException("Membership slot must be 1 or 2");
        this.couple = couple; this.user = user; this.slot = slot; joinedAt = now;
    }
    public UUID getId() { return id; }
    public Couple getCouple() { return couple; }
    public User getUser() { return user; }
    public int getSlot() { return slot; }
    public Instant getJoinedAt() { return joinedAt; }
    public Instant getLeftAt() { return leftAt; }
    public void leave(Instant now) { leftAt = now; }
}
