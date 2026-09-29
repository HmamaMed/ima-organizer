package com.lifeorganizer.gym;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A named plan, e.g. "October — Glow up". Exactly one programme is active at a
 * time; that's the one the recipient sees, so she never has to choose between
 * plans. The owner can keep older ones around and switch back.
 */
@Entity
@Table(name = "programmes")
public class Programme {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(nullable = false)
    private boolean active;

    @Column(nullable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "programme", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProgrammeDay> days = new ArrayList<>();

    protected Programme() {
        // for JPA
    }

    public Programme(String name, String description, boolean active) {
        this.name = name;
        this.description = description;
        this.active = active;
        this.createdAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<ProgrammeDay> getDays() {
        return days;
    }

    /**
     * Appends a day. Uses max+1 rather than size(): deleting a middle day
     * leaves a gap (0, 1, 3), and size() would then hand out a sortOrder that
     * already exists, making the order ambiguous.
     */
    public void addDay(ProgrammeDay day) {
        int nextOrder = days.stream().mapToInt(ProgrammeDay::getSortOrder).max().orElse(-1) + 1;
        day.setSortOrder(nextOrder);
        day.setProgramme(this);
        days.add(day);
    }
}
