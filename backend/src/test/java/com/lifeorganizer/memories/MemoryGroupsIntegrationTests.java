package com.lifeorganizer.memories;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Exercises the real controllers, validation, security, services and database mapping. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:memory-groups;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "firebase.service-account-path=/nonexistent/test-firebase.json"
})
@AutoConfigureMockMvc
@Transactional
class MemoryGroupsIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired MemoryService service;
    @Autowired MemoryRepository memories;
    @Autowired MemoryGroupRepository groups;

    @Test
    @WithMockUser(roles = "OWNER")
    void groupCanExistEmptyAndNewMemoriesBelongToItWithoutChangingLegacyMemories() throws Exception {
        Memory legacy = memories.saveAndFlush(new Memory("https://example.com/old.jpg", "Original story", null, LocalDate.of(2025, 1, 2)));
        mvc.perform(post("/api/memories/groups").contentType("application/json")
                .content("{\"name\":\"  Birthday memories  \",\"description\":\"  Each year together  \"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Birthday memories"))
                .andExpect(jsonPath("$.description").value("Each year together"));
        MemoryGroup birthday = groups.findAll().getFirst();
        assertThat(memories.count()).isEqualTo(1);
        mvc.perform(get("/api/memories/groups")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(birthday.getId().toString()));
        mvc.perform(post("/api/memories").contentType("application/json").content("""
                {"photoUrl":"https://example.com/birthday.jpg","caption":"Birthday!",
                 "audioUrl":"https://example.com/voice.webm","memoryDate":"2026-10-03","groupId":"%s"}
                """.formatted(birthday.getId())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.groupId").value(birthday.getId().toString()))
                .andExpect(jsonPath("$.audioUrl").value("https://example.com/voice.webm"));
        MemoryGroup trips = groups.saveAndFlush(new MemoryGroup("Trips", null));
        service.create(new MemoryRequest("https://example.com/trip.jpg", null, null, LocalDate.of(2026, 8, 1), trips.getId()));
        assertThat(service.list()).hasSize(3);
        assertThat(service.list().stream().filter(m -> birthday.getId().equals(m.groupId())).toList()).hasSize(1);
        assertThat(service.list().stream().filter(m -> legacy.getId().equals(m.id())).findFirst().orElseThrow().groupId()).isNull();
        mvc.perform(get("/api/memories")).andExpect(status().isOk()).andExpect(jsonPath("$[0].caption").value("Birthday!"));
    }

    @Test
    @WithMockUser(roles = "OWNER")
    void legacyClientsCanStillCreateWithoutAGroup() throws Exception {
        mvc.perform(post("/api/memories").contentType("application/json")
                .content("{\"photoUrl\":\"https://example.com/photo.jpg\",\"memoryDate\":\"2026-10-03\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.groupId").isEmpty());
        assertThat(memories.count()).isEqualTo(1);
        assertThat(service.list().getFirst().groupId()).isNull();
    }

    @Test
    @WithMockUser(roles = "OWNER")
    void unknownGroupCannotCreateAnOrphanMemory() throws Exception {
        mvc.perform(post("/api/memories").contentType("application/json").content("""
                {"photoUrl":"https://example.com/photo.jpg","memoryDate":"2026-10-03","groupId":"%s"}
                """.formatted(UUID.randomUUID())))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.message").value("Memory group not found"));
        assertThat(memories.count()).isZero();
    }

    @Test
    @WithMockUser(roles = "OWNER")
    void invalidGroupNamesAndLongDescriptionsAreRejected() throws Exception {
        for (String body : new String[] {
                "{\"name\":\"   \"}", "{\"name\":\"" + "x".repeat(101) + "\"}",
                "{\"name\":\"Birthday\",\"description\":\"" + "x".repeat(501) + "\"}"}) {
            mvc.perform(post("/api/memories/groups").contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        assertThat(groups.count()).isZero();
    }

    @Test
    @WithMockUser(roles = "RECIPIENT")
    void recipientCanReadGroupsAndMemoriesButCannotCreateThem() throws Exception {
        MemoryGroup group = groups.saveAndFlush(new MemoryGroup("Birthday memories", null));
        service.create(new MemoryRequest("https://example.com/photo.jpg", "Happy birthday", null, LocalDate.now(), group.getId()));
        mvc.perform(get("/api/memories/groups")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Birthday memories"));
        mvc.perform(get("/api/memories")).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].groupId").value(group.getId().toString()));
        mvc.perform(post("/api/memories/groups").contentType("application/json").content("{\"name\":\"Forbidden\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/memories").contentType("application/json")
                .content("{\"photoUrl\":\"https://example.com/photo.jpg\",\"memoryDate\":\"2026-10-03\"}"))
                .andExpect(status().isForbidden());
        assertThat(groups.count()).isEqualTo(1);
        assertThat(memories.count()).isEqualTo(1);
    }

    @Test
    void anonymousCannotReadGroups() throws Exception {
        mvc.perform(get("/api/memories/groups")).andExpect(status().isUnauthorized());
    }
}
