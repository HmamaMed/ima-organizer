package com.lifeorganizer.memories;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.NoSuchElementException;

/**
 * Business logic for the memory timeline. The backend never touches raw file
 * bytes — the client uploads media to storage and sends the URL.
 */
@Service
public class MemoryService {

    private final MemoryRepository memoryRepository;
    private final MemoryGroupRepository groupRepository;

    public MemoryService(MemoryRepository memoryRepository, MemoryGroupRepository groupRepository) {
        this.memoryRepository = memoryRepository;
        this.groupRepository = groupRepository;
    }

    @Transactional
    public MemoryResponse create(MemoryRequest request) {
        Memory memory = new Memory(
                request.photoUrl(),
                request.caption(),
                request.audioUrl(),
                request.memoryDate());
        if (request.groupId() != null) {
            memory.setGroup(groupRepository.findById(request.groupId())
                    .orElseThrow(() -> new NoSuchElementException("Memory group not found")));
        }
        memoryRepository.save(memory);
        return MemoryResponse.from(memory);
    }

    /** Timeline ordered by memory date, newest first. */
    @Transactional(readOnly = true)
    public List<MemoryResponse> list() {
        return memoryRepository.findAllByOrderByMemoryDateDesc()
                .stream()
                .map(MemoryResponse::from)
                .toList();
    }

    @Transactional
    public MemoryGroupResponse createGroup(MemoryGroupRequest request) {
        String description = request.description() == null ? null : request.description().trim();
        MemoryGroup group = new MemoryGroup(request.name().trim(),
                description == null || description.isEmpty() ? null : description);
        return MemoryGroupResponse.from(groupRepository.save(group));
    }

    @Transactional(readOnly = true)
    public List<MemoryGroupResponse> listGroups() {
        return groupRepository.findAllByOrderByCreatedAtAsc().stream()
                .map(MemoryGroupResponse::from).toList();
    }
}
