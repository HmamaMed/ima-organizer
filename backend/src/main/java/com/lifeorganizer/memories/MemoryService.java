package com.lifeorganizer.memories;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Business logic for the memory timeline. The backend never touches raw file
 * bytes — the client uploads media to Firebase Storage and sends the URL.
 */
@Service
public class MemoryService {

    private final MemoryRepository memoryRepository;

    public MemoryService(MemoryRepository memoryRepository) {
        this.memoryRepository = memoryRepository;
    }

    @Transactional
    public MemoryResponse create(MemoryRequest request) {
        Memory memory = new Memory(
                request.photoUrl(),
                request.caption(),
                request.audioUrl(),
                request.memoryDate());
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
}
