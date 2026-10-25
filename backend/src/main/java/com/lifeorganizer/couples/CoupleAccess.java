package com.lifeorganizer.couples;

import com.lifeorganizer.auth.User;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.util.UUID;

/** Resolve membership from the database on every operation, never from JWT claims. */
@Service
@Transactional(propagation = Propagation.MANDATORY)
public class CoupleAccess {
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;
    private final CoupleMembershipRepository memberships;
    private final CoupleRepository couples;
    private final boolean enabled;
    private final org.springframework.jdbc.core.JdbcTemplate jdbc;

    public CoupleAccess(CoupleMembershipRepository memberships, CoupleRepository couples, Environment environment,org.springframework.jdbc.core.JdbcTemplate jdbc) {
        this.jdbc=jdbc;
        this.memberships = memberships; this.couples = couples;
        enabled = environment.acceptsProfiles(Profiles.of("couples"));
    }

    public UUID requireScope(User user) { return resolve(user, false); }

    /** Future join/disconnect services must take this same couple lock before changing memberships. */
    public UUID requireScopeForWrite(User user) { return resolve(user, true); }

    private UUID resolve(User user, boolean forWrite) {
        if (user == null) throw new AccessDeniedException("Authentication required");
        // Only the original personal deployment can access the legacy NULL scope.
        if (!enabled) return null;
        var membership = memberships.findByUserIdAndLeftAtIsNull(user.getId())
                .orElseThrow(() -> new AccessDeniedException("An active couple membership is required"));
        Couple couple = membership.getCouple();
        if (forWrite) {
            couple = couples.lockById(couple.getId())
                    .orElseThrow(() -> new AccessDeniedException("Couple is unavailable"));
            entityManager.refresh(couple); // Do not reuse a status loaded before waiting for the lock.
            // A disconnect may have committed while the lock was being acquired.
            if (!memberships.existsByUserIdAndCoupleIdAndLeftAtIsNull(user.getId(), couple.getId())) {
                throw new AccessDeniedException("Couple membership has ended");
            }
        }
        boolean marked=Boolean.TRUE.equals(jdbc.queryForObject("select exists(select 1 from couple_memberships m join deletion_markers d on d.user_id=m.user_id where m.couple_id=?)",Boolean.class,couple.getId()));
        if(marked) throw new AccessDeniedException("Couple is closed");
        if (couple.getStatus() == Couple.Status.CLOSED) throw new AccessDeniedException("Couple is closed");
        return couple.getId();
    }
}
