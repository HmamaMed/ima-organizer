package com.lifeorganizer.agios;

import com.lifeorganizer.auth.User;
import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** An interest credit (positive) or withdrawal (negative) belonging to a shared account. */
@Entity
@Table(name = "agios", indexes = @Index(name = "agios_user_date_idx", columnList = "user_id,credit_date"))
public class Agio {
    @Id
    @GeneratedValue
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "credit_date", nullable = false)
    private LocalDate date;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected Agio() {}

    public Agio(User user, BigDecimal amount, LocalDate date) {
        this.user = user;
        this.amount = amount;
        this.date = date;
        this.createdAt = Instant.now();
    }

    public void update(BigDecimal amount, LocalDate date) {
        this.amount = amount;
        this.date = date;
    }

    public UUID getId() { return id; }
    public User getUser() { return user; }
    public BigDecimal getAmount() { return amount; }
    public LocalDate getDate() { return date; }
    public Instant getCreatedAt() { return createdAt; }
}
