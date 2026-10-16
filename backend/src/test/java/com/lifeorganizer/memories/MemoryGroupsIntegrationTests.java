package com.lifeorganizer.memories;

import com.lifeorganizer.media.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import software.amazon.awssdk.services.s3.model.S3Object;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:memory-groups;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "firebase.service-account-path=/nonexistent/test-firebase.json",
    "app.memories.cleanup-cron=-", "app.memories.orphan-cron=-", "app.birthdays.cron=-"
})
@AutoConfigureMockMvc
class MemoryGroupsIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired MemoryService service;
    @Autowired MemoryCleanupService cleanup;
    @Autowired MemoryRepository memories;
    @Autowired MemoryGroupRepository groups;
    @Autowired MediaAssetRepository assets;
    @Autowired MediaUploadService uploadService;
    @Autowired JdbcTemplate jdbc;
    @MockitoBean R2Storage storage;
    @MockitoBean LegacySupabaseStorage legacy;

    @BeforeEach void prepare() {
        memories.deleteAllInBatch(); assets.deleteAllInBatch(); groups.deleteAllInBatch();
        when(storage.readUrl(anyString(),any(Instant.class),any(Instant.class))).thenAnswer(i -> "https://private-r2.test/" + i.getArgument(0) + "?signed=temporary");
        when(storage.listGroup(any())).thenReturn(List.of());
    }
    MemoryGroup group(String name) { return groups.saveAndFlush(new MemoryGroup(name,null)); }
    MediaAsset asset(MemoryGroup group,String type) {
        return assets.saveAndFlush(new MediaAsset(group,R2Storage.groupPrefix(group.getId())+UUID.randomUUID(),type,3));
    }
    MemoryResponse memory(MemoryGroup group, boolean withAudio) {
        return service.create(new MemoryRequest(asset(group,"image/jpeg").getId(),"A moment",withAudio ? asset(group,"audio/webm").getId() : null,LocalDate.of(2026,10,3),group.getId()));
    }
    void expire(UUID id) { jdbc.update("update memory_groups set expires_at = ? where id = ?",Timestamp.from(Instant.now().minusSeconds(1)),id); }
    String input(UUID group,UUID photo,UUID audio) {
        return "{\"photoAssetId\":\"%s\",\"audioAssetId\":%s,\"memoryDate\":\"2026-10-03\",\"groupId\":\"%s\"}".formatted(photo,audio == null ? "null" : "\""+audio+"\"",group);
    }
    @Test @WithMockUser(roles="OWNER")
    void groupLivesExactlyThreeDaysAndAcceptsTrackedPhotoAndAudio() throws Exception {
        mvc.perform(post("/api/memories/groups").contentType("application/json").content("""
            {"name":"  Birthday memories  ","description":"  Three lovely days  "}
            """))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.name").value("Birthday memories")).andExpect(jsonPath("$.description").value("Three lovely days"))
            .andExpect(jsonPath("$.expiresAt").exists());
        MemoryGroup group=groups.findAll().getFirst();
        assertThat(Duration.between(group.getCreatedAt(),group.getExpiresAt())).isEqualTo(Duration.ofHours(72));
        MediaAsset photo=asset(group,"image/jpeg"), audio=asset(group,"audio/webm");
        String payload = input(group.getId(),photo.getId(),audio.getId()).replace("\"memoryDate\"", "\"caption\":\"" + "c".repeat(1000) + "\",\"memoryDate\"");
        mvc.perform(post("/api/memories").contentType("application/json").content(payload))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.groupId").value(group.getId().toString()))
            .andExpect(jsonPath("$.photoUrl").value(org.hamcrest.Matchers.startsWith("https://private-r2.test/")))
            .andExpect(jsonPath("$.audioUrl").exists()).andExpect(jsonPath("$.expiresAt").exists());
        assertThat(memories.findAll().getFirst().getCaption()).hasSize(1000);
        assertThat(assets.findById(photo.getId()).orElseThrow().isAttached()).isTrue();
        assertThat(groups.findById(group.getId()).orElseThrow().getExpiresAt()).isEqualTo(group.getExpiresAt());
    }
    @Test @WithMockUser(roles="OWNER")
    void oldClientCannotCreatePermanentUrlOnlyMemories() throws Exception {
        mvc.perform(post("/api/memories").contentType("application/json").content("{\"photoUrl\":\"https://example.com/photo.jpg\",\"memoryDate\":\"2026-10-03\"}"))
            .andExpect(status().isBadRequest());
        assertThat(memories.count()).isZero();
    }
    @Test @WithMockUser(roles="OWNER")
    void unknownAndExpiredCategoryCannotReceiveMediaOrMemory() throws Exception {
        UUID unknown=UUID.randomUUID();
        var file=new MockMultipartFile("file","photo.jpg","image/jpeg",new byte[]{1,2,3});
        mvc.perform(multipart("/api/memories/groups/"+unknown+"/media").file(file)).andExpect(status().isNotFound());
        MemoryGroup group=group("Expired"); MediaAsset photo=asset(group,"image/jpeg"); expire(group.getId());
        mvc.perform(multipart("/api/memories/groups/"+group.getId()+"/media").file(file)).andExpect(status().isNotFound());
        mvc.perform(post("/api/memories").contentType("application/json").content(input(group.getId(),photo.getId(),null))).andExpect(status().isNotFound());
        assertThat(memories.count()).isZero(); verify(storage,never()).upload(anyString(),any(),anyLong(),anyString());
    }
    @Test @WithMockUser(roles="OWNER")
    void invalidGroupNamesAndDescriptionsAreRejected() throws Exception {
        for (String body : List.of("{\"name\":\"  \"}","{\"name\":\""+"x".repeat(101)+"\"}","{\"name\":\"Birthday\",\"description\":\""+"x".repeat(501)+"\"}"))
            mvc.perform(post("/api/memories/groups").contentType("application/json").content(body)).andExpect(status().isBadRequest());
        assertThat(groups.count()).isZero();
    }
    @Test @WithMockUser(roles="RECIPIENT")
    void recipientCanReadButCannotUploadCreateDeleteOrTriggerCleanup() throws Exception {
        MemoryGroup group=group("Shared"); memory(group,true);
        mvc.perform(get("/api/memories/groups")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(get("/api/memories")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(post("/api/memories/groups").contentType("application/json").content("{\"name\":\"No\"}")).andExpect(status().isForbidden());
        mvc.perform(multipart("/api/memories/groups/"+group.getId()+"/media").file(new MockMultipartFile("file","x.jpg","image/jpeg",new byte[]{1}))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/memories/groups/"+group.getId())).andExpect(status().isForbidden());
        mvc.perform(post("/api/memories/cleanup")).andExpect(status().isForbidden());
    }
    @Test void anonymousCannotReadOrUpload() throws Exception {
        mvc.perform(get("/api/memories/groups")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/memories")).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/memories/groups/"+UUID.randomUUID()+"/media").file(new MockMultipartFile("file","x.jpg","image/jpeg",new byte[]{1}))).andExpect(status().isUnauthorized());
    }
    @Test @WithMockUser(roles="OWNER")
    void expiredDataDisappearsImmediatelyAndDeletionFailureRetainsRetryReferences() throws Exception {
        MemoryGroup group=group("Temporary"); memory(group,true); expire(group.getId());
        mvc.perform(get("/api/memories/groups")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/api/memories")).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        doThrow(new MediaStorageException("offline")).when(storage).deleteGroup(group.getId());
        assertThatThrownBy(() -> cleanup.purge(group.getId(),Instant.now())).isInstanceOf(MediaStorageException.class);
        assertThat(groups.count()).isEqualTo(1); assertThat(memories.count()).isEqualTo(1); assertThat(assets.count()).isEqualTo(2);
        doNothing().when(storage).deleteGroup(group.getId()); cleanup.purge(group.getId(),Instant.now());
        assertThat(groups.count()).isZero(); assertThat(memories.count()).isZero(); assertThat(assets.count()).isZero();
        cleanup.purge(group.getId(),Instant.now()); verify(storage,times(2)).deleteGroup(group.getId());
    }
    @Test @WithMockUser(roles="OWNER")
    void explicitDeletePurgesWholeCategoryIncludingAbandonedFilesWithoutTouchingAnotherCategory() throws Exception {
        MemoryGroup group=group("Delete"), kept=group("Keep"); memory(group,true); memory(kept,false); asset(group,"image/png");
        mvc.perform(delete("/api/memories/groups/"+group.getId())).andExpect(status().isAccepted());
        assertThat(service.listGroups()).hasSize(1); assertThat(service.list()).hasSize(1);
        cleanup.purge(group.getId(),Instant.now()); verify(storage).deleteGroup(group.getId()); verify(storage,never()).deleteGroup(kept.getId());
        assertThat(groups.count()).isEqualTo(1); assertThat(assets.count()).isEqualTo(1); assertThat(memories.count()).isEqualTo(1);
    }
    @Test
    void oldGroupedAndUngroupedMemoriesAreErasedInsteadOfMigrated() {
        MemoryGroup old=group("Old"); jdbc.update("update memory_groups set expires_at = null where id = ?",old.getId());
        Memory photo=new Memory("https://old.test/storage/v1/object/public/media/memories/photo.jpg",null,"https://old.test/storage/v1/object/public/media/memories/voice.webm",LocalDate.now());
        photo.setGroup(old); memories.saveAndFlush(photo);
        memories.saveAndFlush(new Memory("https://old.test/storage/v1/object/public/media/memories/ungrouped.jpg",null,null,LocalDate.now()));
        assertThat(service.list()).isEmpty(); assertThat(service.listGroups()).isEmpty();
        cleanup.queueLegacy();
        for (UUID id:groups.findDueIds(Instant.now())) cleanup.purge(id,Instant.now());
        verify(legacy).delete(photo.getPhotoUrl()); verify(legacy).delete(photo.getAudioUrl());
        verify(legacy).delete("https://old.test/storage/v1/object/public/media/memories/ungrouped.jpg");
        verify(storage,never()).upload(anyString(),any(),anyLong(),anyString());
        assertThat(memories.count()).isZero(); assertThat(groups.count()).isZero();
    }
    @Test
    void missingLegacyDeletionPermissionDoesNotSilentlyLoseFileReferences() {
        MemoryGroup old=group("Old"); jdbc.update("update memory_groups set expires_at = null where id = ?",old.getId());
        memories.saveAndFlush(new Memory("https://old.test/storage/v1/object/public/media/memories/old.jpg",null,null,LocalDate.now()));
        cleanup.queueLegacy();
        UUID id=groups.findDueIds(Instant.now()).stream().filter(x -> !x.equals(old.getId())).findFirst().orElseThrow();
        doThrow(new MediaStorageException("credentials missing")).when(legacy).delete(anyString());
        assertThatThrownBy(() -> cleanup.purge(id,Instant.now())).isInstanceOf(MediaStorageException.class);
        assertThat(memories.count()).isEqualTo(1); assertThat(service.list()).isEmpty();
        doNothing().when(legacy).delete(anyString()); cleanup.purge(id,Instant.now()); assertThat(memories.count()).isZero();
    }
    @Test @WithMockUser(roles="OWNER")
    void crossCategoryWrongTypeAndReusedAssetsCannotBeAttached() throws Exception {
        MemoryGroup group=group("One"), other=group("Two");
        MediaAsset photo=asset(group,"image/jpeg"), foreign=asset(other,"image/jpeg"), audio=asset(group,"audio/webm");
        for (UUID invalid : List.of(foreign.getId(),audio.getId()))
            mvc.perform(post("/api/memories").contentType("application/json").content(input(group.getId(),invalid,null))).andExpect(status().isBadRequest());
        mvc.perform(post("/api/memories").contentType("application/json").content(input(group.getId(),photo.getId(),null))).andExpect(status().isCreated());
        mvc.perform(post("/api/memories").contentType("application/json").content(input(group.getId(),photo.getId(),null))).andExpect(status().isConflict());
        assertThat(memories.count()).isEqualTo(1);
    }
    @Test @WithMockUser(roles="OWNER")
    void uploadTracksBytesTypeAndCategoryAndRejectsUnsafeOrEmptyFiles() throws Exception {
        MemoryGroup group=group("Uploads");
        mvc.perform(multipart("/api/memories/groups/"+group.getId()+"/media").file(new MockMultipartFile("file","photo.jpg","image/jpeg",new byte[]{1,2,3})))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.id").exists());
        verify(storage).upload(startsWith(R2Storage.groupPrefix(group.getId())),any(),eq(3L),eq("image/jpeg"));
        for (var file : List.of(new MockMultipartFile("file","x.svg","image/svg+xml",new byte[]{1}),new MockMultipartFile("file","empty.jpg","image/jpeg",new byte[0])))
            mvc.perform(multipart("/api/memories/groups/"+group.getId()+"/media").file(file)).andExpect(status().isBadRequest());
        assertThat(assets.count()).isEqualTo(1);
    }
    @Test @WithMockUser(roles="OWNER")
    void failedUploadIsNotReportedAsSuccessAndPrefixCleanupStillCatchesInterruptedWrites() throws Exception {
        MemoryGroup group=group("Failure");
        doThrow(new MediaStorageException("Unavailable")).when(storage).upload(anyString(),any(),anyLong(),anyString());
        mvc.perform(multipart("/api/memories/groups/"+group.getId()+"/media").file(new MockMultipartFile("file","photo.jpg","image/jpeg",new byte[]{1})))
            .andExpect(status().isServiceUnavailable());
        assertThat(assets.count()).isZero(); expire(group.getId()); cleanup.purge(group.getId(),Instant.now()); verify(storage).deleteGroup(group.getId());
    }
    @Test
    void abandonedUploadsAndUntrackedObjectsAreRemovedAfter24HoursButAttachedMediaIsKept() {
        MemoryGroup group=group("Abandoned"); MemoryResponse saved=memory(group,false); MediaAsset abandoned=asset(group,"audio/webm");
        jdbc.update("update media_assets set created_at = ?",Timestamp.from(Instant.now().minus(Duration.ofHours(25))));
        String orphan=R2Storage.groupPrefix(group.getId())+"orphan.jpg";
        String kept=assets.findByGroupId(group.getId()).stream().filter(MediaAsset::isAttached).findFirst().orElseThrow().getObjectKey();
        when(storage.listGroup(group.getId())).thenReturn(List.of(S3Object.builder().key(orphan).lastModified(Instant.now().minus(Duration.ofHours(25))).build(),S3Object.builder().key(kept).lastModified(Instant.now().minus(Duration.ofHours(25))).build()));
        cleanup.removeAbandonedUploads(group.getId(),Instant.now());
        verify(storage).deleteObject(abandoned.getObjectKey()); verify(storage).deleteObject(orphan); verify(storage,never()).deleteObject(kept);
        assertThat(assets.count()).isEqualTo(1); assertThat(service.list().getFirst().id()).isEqualTo(saved.id());
    }

    @Test
    void deletionWaitsForAnInFlightUploadThenPurgesItsFileAndPreventsAnyLaterUpload() throws Exception {
        MemoryGroup group=group("Race");
        CountDownLatch entered=new CountDownLatch(1), release=new CountDownLatch(1);
        doAnswer(invocation -> { entered.countDown(); if (!release.await(5,TimeUnit.SECONDS)) throw new IllegalStateException("test upload timed out"); return null; })
            .when(storage).upload(anyString(),any(),anyLong(),anyString());
        try (var executor=Executors.newFixedThreadPool(2)) {
            var uploading=executor.submit(() -> uploadService.upload(group.getId(),new MockMultipartFile("file","x.jpg","image/jpeg",new byte[]{1})));
            assertThat(entered.await(5,TimeUnit.SECONDS)).isTrue();
            var deleting=executor.submit(() -> service.deleteGroup(group.getId()));
            assertThat(deleting.isDone()).isFalse();
            release.countDown(); uploading.get(10,TimeUnit.SECONDS); deleting.get(10,TimeUnit.SECONDS);
        }
        assertThat(service.listGroups()).isEmpty();
        cleanup.purge(group.getId(),Instant.now());
        assertThat(assets.count()).isZero(); verify(storage).deleteGroup(group.getId());
        assertThatThrownBy(() -> uploadService.upload(group.getId(),new MockMultipartFile("file","x.jpg","image/jpeg",new byte[]{1})))
            .isInstanceOf(NoSuchElementException.class);
    }
}
