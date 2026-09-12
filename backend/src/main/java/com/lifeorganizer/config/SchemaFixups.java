package com.lifeorganizer.config;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Patches for schema drift that {@code spring.jpa.hibernate.ddl-auto: update}
 * cannot handle on its own — specifically, Hibernate creates a CHECK
 * constraint for an {@code @Enumerated(STRING)} column the first time the
 * table is created, but never widens it when new enum constants are added
 * later. Each fixup here is idempotent (drop-then-recreate), safe to run on
 * every boot, and must run as a {@link CommandLineRunner} (not
 * {@code @PostConstruct}) so {@code @Transactional} actually applies — it
 * needs to go through the proxy, which only happens once the context is
 * fully up.
 */
@Component
@Order(0)
public class SchemaFixups implements CommandLineRunner {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    @Transactional
    public void run(String... args) {
        widenNotesStatusConstraint();
    }

    private void widenNotesStatusConstraint() {
        entityManager.createNativeQuery(
                "ALTER TABLE notes DROP CONSTRAINT IF EXISTS notes_status_check").executeUpdate();
        entityManager.createNativeQuery(
                "ALTER TABLE notes ADD CONSTRAINT notes_status_check "
                        + "CHECK (status IN ('DRAFT','SCHEDULED','SENT','CANCELLED'))").executeUpdate();
    }
}
