package com.lifeorganizer.wishes;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.media.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:wishes;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "firebase.service-account-path=/nonexistent/test-firebase.json",
    "app.wishes.cleanup-cron=-", "app.memories.cleanup-cron=-", "app.memories.orphan-cron=-", "app.birthdays.cron=-"
})
@AutoConfigureMockMvc
class WishIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    @Autowired WishRepository wishes;
    @Autowired WishPhotoRepository photos;
    @Autowired WishService service;
    @Autowired WishPhotoService uploads;
    @Autowired WishPhotoLedger ledger;
    @Autowired WishPhotoCleanup cleanup;
    @MockitoBean R2Storage storage;
    User owner, recipient;

    @BeforeEach void prepare() {
        wishes.deleteAllInBatch(); photos.deleteAllInBatch();
        owner = users.findByRole(Role.OWNER).orElseThrow(); recipient = users.findByRole(Role.RECIPIENT).orElseThrow();
        when(storage.readUrl(anyString(),isNull(),any(Instant.class))).thenAnswer(i -> "https://private-r2.test/" + i.getArgument(0) + "?signed=temporary");
    }
    String auth(User user) { return "Bearer " + jwt.generateToken(user); }
    WishRequest input(UUID photo) { return new WishRequest("  Un joli livre  ",WishCategory.BOOK,"  Édition illustrée  ","https://example.com/book",photo); }
    String body(UUID photo) { return "{\"title\":\"Un joli livre\",\"category\":\"BOOK\",\"details\":\"Édition illustrée\",\"link\":\"https://example.com/book\",\"photoId\":" + (photo == null ? "null" : "\""+photo+"\"") + "}"; }
    MockMultipartFile image() { return new MockMultipartFile("file","photo.png","image/png",new byte[]{1,2,3}); }
    UUID upload() { return uploads.upload(recipient,image()).id(); }

    @Test void recipientManagesTheListAndOwnerCanOnlyRead() throws Exception {
        mvc.perform(get("/api/wishes")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/wishes").header("Authorization",auth(owner)).contentType("application/json").content(body(null))).andExpect(status().isForbidden());
        mvc.perform(post("/api/wishes").header("Authorization",auth(recipient)).contentType("application/json").content(body(null)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.title").value("Un joli livre")).andExpect(jsonPath("$.photoUrl").isEmpty());
        UUID id = wishes.findAll().getFirst().getId();
        for (User user : List.of(owner,recipient)) mvc.perform(get("/api/wishes").header("Authorization",auth(user)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].category").value("BOOK"));
        mvc.perform(put("/api/wishes/"+id).header("Authorization",auth(owner)).contentType("application/json").content(body(null))).andExpect(status().isForbidden());
        mvc.perform(delete("/api/wishes/"+id).header("Authorization",auth(owner))).andExpect(status().isForbidden());
        mvc.perform(put("/api/wishes/"+id).header("Authorization",auth(recipient)).contentType("application/json").content(body(null).replace("Un joli livre","Une sortie à deux").replace("BOOK","EXPERIENCE")))
            .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Une sortie à deux"));
        mvc.perform(delete("/api/wishes/"+id).header("Authorization",auth(recipient))).andExpect(status().isNoContent());
        mvc.perform(delete("/api/wishes/"+id).header("Authorization",auth(recipient))).andExpect(status().isNotFound());
    }
    @Test void titleCategoryAndLinksAreValidatedWithoutFetchingExternalSites() throws Exception {
        for (String invalid : List.of(
                body(null).replace("Un joli livre"," "), body(null).replace("Un joli livre","a".repeat(151)),
                body(null).replace("BOOK","UNKNOWN"), body(null).replace("https://example.com/book","javascript:alert(1)"),
                body(null).replace("https://example.com/book","file:///tmp/private"), body(null).replace("https://example.com/book","https://user:password@example.com/"),
                body(null).replace("https://example.com/book","/relative-link"), "{}")) {
            mvc.perform(post("/api/wishes").header("Authorization",auth(recipient)).contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
        }
        assertThat(wishes.count()).isZero(); verifyNoInteractions(storage);
        mvc.perform(post("/api/wishes").header("Authorization",auth(recipient)).contentType("application/json").content("{\"title\":\"Un objet\",\"category\":\"OBJECT\"}"))
            .andExpect(status().isCreated());
    }
    @Test void photoUploadRequiresRecipientAndValidImageTypeAndSize() throws Exception {
        mvc.perform(multipart("/api/wishes/photos").file(image())).andExpect(status().isUnauthorized());
        mvc.perform(multipart("/api/wishes/photos").file(image()).header("Authorization",auth(owner))).andExpect(status().isForbidden());
        for (MockMultipartFile invalid : List.of(new MockMultipartFile("file","voice.webm","audio/webm",new byte[]{1}),
                new MockMultipartFile("file","empty.png","image/png",new byte[0]),
                new MockMultipartFile("file","large.png","image/png",new byte[10*1024*1024+1]))) {
            mvc.perform(multipart("/api/wishes/photos").file(invalid).header("Authorization",auth(recipient))).andExpect(status().isBadRequest());
        }
        assertThat(photos.count()).isZero();
        mvc.perform(multipart("/api/wishes/photos").file(image()).header("Authorization",auth(recipient)))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.id").exists()).andExpect(jsonPath("$.objectKey").doesNotExist());
        verify(storage).upload(startsWith("wishes/"),any(),eq(3L),eq("image/png"));
    }
    @Test void photosStayPrivateAndAttachedWishesDoNotExpireAfterThreeDays() {
        UUID photo = upload();
        WishResponse wish = service.create(recipient,input(photo));
        assertThat(wish.title()).isEqualTo("Un joli livre");
        assertThat(wish.details()).isEqualTo("Édition illustrée");
        assertThat(wish.photoUrl()).startsWith("https://private-r2.test/wishes/").contains("signed=temporary");
        assertThat(wish.photoId()).isEqualTo(photo);
        ledger.purge(photo,Instant.now().plus(Duration.ofDays(365)));
        assertThat(photos.existsById(photo)).isTrue(); assertThat(service.list()).hasSize(1);
        verify(storage,never()).deleteObject(anyString());
    }
    @Test void photoCannotBeReusedAndForeignMissingOrExpiredUploadsAreRejected() {
        UUID photo = upload(); service.create(recipient,input(photo));
        assertThatThrownBy(() -> service.create(recipient,input(photo))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.create(recipient,input(UUID.randomUUID()))).isInstanceOf(NoSuchElementException.class);
        WishPhoto foreign = photos.saveAndFlush(new WishPhoto(owner,"wishes/foreign.png",Instant.now())); ledger.ready(foreign.getId());
        assertThatThrownBy(() -> service.create(recipient,input(foreign.getId()))).isInstanceOf(IllegalArgumentException.class);
        WishPhoto expired = photos.saveAndFlush(new WishPhoto(recipient,"wishes/expired.png",Instant.now().minus(Duration.ofDays(2)))); ledger.ready(expired.getId());
        assertThatThrownBy(() -> service.create(recipient,input(expired.getId()))).isInstanceOf(IllegalArgumentException.class);
        assertThat(wishes.count()).isEqualTo(1);
    }
    @Test void replacingThenRemovingPhotoDeletesOnlyDetachedFilesAndRetriesFailures() {
        UUID first = upload(); WishResponse wish = service.create(recipient,input(first));
        String oldKey = photos.findById(first).orElseThrow().getObjectKey();
        UUID second = upload();
        service.update(recipient,wish.id(),input(second));
        doThrow(new MediaStorageException("offline")).doNothing().when(storage).deleteObject(oldKey);
        cleanup.runOnce(); assertThat(photos.existsById(first)).isTrue();
        cleanup.runOnce(); assertThat(photos.existsById(first)).isFalse();
        assertThat(photos.existsById(second)).isTrue(); assertThat(service.list().getFirst().photoId()).isEqualTo(second);
        service.update(recipient,wish.id(),input(null)); cleanup.runOnce();
        assertThat(photos.count()).isZero(); assertThat(service.list().getFirst().photoUrl()).isNull();
    }
    @Test void deletingWishQueuesItsPhotoWithoutRequiringStorageToBeOnline() {
        UUID photo = upload(); WishResponse wish = service.create(recipient,input(photo));
        String key = photos.findById(photo).orElseThrow().getObjectKey();
        doThrow(new MediaStorageException("offline")).doNothing().when(storage).deleteObject(key);
        service.delete(wish.id()); assertThat(service.list()).isEmpty();
        cleanup.runOnce(); assertThat(photos.existsById(photo)).isTrue();
        cleanup.runOnce(); assertThat(photos.count()).isZero();
    }
    @Test void abandonedAndFailedUploadsRemainTrackedUntilCleanupSucceeds() {
        doThrow(new MediaStorageException("upload failed")).when(storage).upload(anyString(),any(),anyLong(),anyString());
        assertThatThrownBy(this::upload).isInstanceOf(MediaStorageException.class);
        WishPhoto failed = photos.findAll().getFirst();
        assertThatThrownBy(() -> service.create(recipient,input(failed.getId()))).isInstanceOf(IllegalArgumentException.class);
        ledger.purge(failed.getId(),Instant.now().plus(Duration.ofDays(2)));
        verify(storage).deleteObject(failed.getObjectKey()); assertThat(photos.count()).isZero();
    }
}
