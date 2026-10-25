package com.lifeorganizer.agios;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.User;
import com.lifeorganizer.auth.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.RoundingMode;
import java.util.Arrays;
import java.util.NoSuchElementException;
import java.util.UUID;

@Service
@Transactional(readOnly = true)
public class AgiosService {
    private final AgioRepository agios;
    private final UserRepository users;

    public AgiosService(AgioRepository agios, UserRepository users) {
        this.agios = agios;
        this.users = users;
    }

    public AgiosTrackerResponse tracker() {
        var participants = java.util.stream.Stream.of(Role.OWNER, Role.RECIPIENT)
                .flatMap(role -> users.findByRole(role).stream())
                .map(AgiosTrackerResponse.Participant::from).toList();
        var entries = agios.findAllByOrderByDateDescCreatedAtDesc().stream()
                .map(AgioResponse::from).toList();
        return new AgiosTrackerResponse(participants, entries);
    }

    @Transactional
    public AgioResponse create(AgioRequest request) {
        User user = users.findById(request.userId())
                .orElseThrow(() -> new NoSuchElementException("Agios account not found"));
        return AgioResponse.from(agios.save(new Agio(user,
                request.amount().setScale(2, RoundingMode.UNNECESSARY), request.date())));
    }

    @Transactional
    public AgioResponse update(UUID id, AgioRequest request) {
        Agio agio = find(id);
        // Correcting an entry must never silently move interest between people.
        if (!agio.getUser().getId().equals(request.userId())) {
            throw new IllegalStateException("An agios entry cannot be moved to another account");
        }
        agio.update(request.amount().setScale(2, RoundingMode.UNNECESSARY), request.date());
        return AgioResponse.from(agio);
    }

    @Transactional
    public void delete(UUID id) {
        agios.delete(find(id));
    }

    private Agio find(UUID id) {
        return agios.findById(id).orElseThrow(() -> new NoSuchElementException("Agios entry not found"));
    }
}
