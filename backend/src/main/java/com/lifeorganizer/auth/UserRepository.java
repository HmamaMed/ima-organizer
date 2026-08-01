package com.lifeorganizer.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByRole(Role role);

    Optional<User> findByName(String name);
}
