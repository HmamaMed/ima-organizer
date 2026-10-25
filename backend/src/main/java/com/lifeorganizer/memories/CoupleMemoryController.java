package com.lifeorganizer.memories;

import com.lifeorganizer.auth.User;
import jakarta.validation.Valid;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.*;

@RestController
@Profile("couples")
@RequestMapping("/api/memories")
public class CoupleMemoryController {
    private final CoupleMemoryService memories;
    public CoupleMemoryController(CoupleMemoryService memories) { this.memories=memories; }
    @GetMapping("/groups") public List<CoupleMemoryService.Group> groups(@AuthenticationPrincipal User user,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) { return memories.groups(user,page,size); }
    @PostMapping("/groups") @ResponseStatus(HttpStatus.CREATED) public CoupleMemoryService.Group group(@AuthenticationPrincipal User user,@RequestHeader("Idempotency-Key") UUID requestId,@Valid @RequestBody MemoryGroupRequest body) { return memories.createGroup(user,body,requestId); }
    @PutMapping("/groups/{id}") public CoupleMemoryService.Group editGroup(@AuthenticationPrincipal User user,@PathVariable UUID id,@Valid @RequestBody MemoryGroupRequest body) { return memories.editGroup(user,id,body); }
    @DeleteMapping("/groups/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void deleteGroup(@AuthenticationPrincipal User user,@PathVariable UUID id) { memories.deleteGroup(user,id); }
    @PostMapping(value="/groups/{id}/media",consumes="multipart/form-data") @ResponseStatus(HttpStatus.CREATED)
    public CoupleMemoryService.Upload upload(@AuthenticationPrincipal User user,@PathVariable UUID id,@RequestPart MultipartFile file) { return memories.upload(user,id,file); }
    @GetMapping public List<CoupleMemoryService.Moment> list(@AuthenticationPrincipal User user,@RequestParam(required=false) UUID groupId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="50") int size) { return memories.list(user,groupId,page,size); }
    @GetMapping("/{id}") public CoupleMemoryService.Moment get(@AuthenticationPrincipal User user,@PathVariable UUID id) { return memories.get(user,id); }
    @PostMapping @ResponseStatus(HttpStatus.CREATED) public CoupleMemoryService.Moment create(@AuthenticationPrincipal User user,@RequestHeader("Idempotency-Key") UUID requestId,@Valid @RequestBody MemoryRequest body) { return memories.create(user,body,requestId); }
    @PutMapping("/{id}") public CoupleMemoryService.Moment edit(@AuthenticationPrincipal User user,@PathVariable UUID id,@Valid @RequestBody CoupleMemoryService.Edit body) { return memories.edit(user,id,body); }
    @DeleteMapping("/{id}") @ResponseStatus(HttpStatus.NO_CONTENT) public void delete(@AuthenticationPrincipal User user,@PathVariable UUID id) { memories.delete(user,id); }
}
