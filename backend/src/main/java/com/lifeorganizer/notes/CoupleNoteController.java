package com.lifeorganizer.notes;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@Profile("couples")
@RequestMapping("/api/notes")
public class CoupleNoteController {
    private final CoupleNoteService notes;
    public CoupleNoteController(CoupleNoteService notes) { this.notes=notes; }
    @GetMapping public List<CoupleNoteService.NoteView> list(@AuthenticationPrincipal User user,@RequestParam(defaultValue="received") String view,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) { return notes.list(user,view,page,size); }
    @GetMapping("/{id}") public CoupleNoteService.NoteView get(@AuthenticationPrincipal User user,@PathVariable UUID id) { return notes.get(user,id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public CoupleNoteService.NoteView create(@AuthenticationPrincipal User user,@RequestHeader("Idempotency-Key") UUID requestId,@Valid @RequestBody CoupleNoteService.Input body) { return notes.create(user,body,requestId); }
    @PutMapping("/{id}") public CoupleNoteService.NoteView update(@AuthenticationPrincipal User user,@PathVariable UUID id,@Valid @RequestBody CoupleNoteService.Input body) { return notes.update(user,id,body); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void cancel(@AuthenticationPrincipal User user,@PathVariable UUID id) { notes.cancel(user,id); }
}
