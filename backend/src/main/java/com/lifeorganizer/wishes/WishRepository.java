package com.lifeorganizer.wishes;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import java.util.*;

public interface WishRepository extends JpaRepository<Wish, UUID> {
    @EntityGraph(attributePaths = "photo")
    List<Wish> findAllByOrderByCreatedAtDescIdDesc();
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from Wish w where w.id = :id")
    Optional<Wish> lockById(UUID id);
}
