package com.lifeorganizer.couples;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "couples")
public class Couple {
    public enum Status { WAITING, ACTIVE, CLOSED }

    @Id @GeneratedValue private UUID id;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private Status status;
    @Column(nullable = false, updatable = false) private Instant createdAt;
    private Instant closedAt;

    protected Couple() {}
    public Couple(Instant now) { status = Status.WAITING; createdAt = now; }
    public UUID getId() { return id; }
    public Status getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getClosedAt() { return closedAt; }

    public void activate() {
        if (status != Status.WAITING) throw new IllegalStateException("Couple is not waiting for a partner");
        status = Status.ACTIVE;
    }

    public void close(Instant now) { status = Status.CLOSED; closedAt = now; }
}
