package com.lifeorganizer.agios;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.User;

import java.util.List;
import java.util.UUID;

public record AgiosTrackerResponse(List<Participant> participants, List<AgioResponse> entries) {
    /** Only public identity fields; never serialize the User entity. */
    public record Participant(UUID userId, String name, Role role) {
        public static Participant from(User user) {
            return new Participant(user.getId(), user.getName(), user.getRole());
        }
    }
}
