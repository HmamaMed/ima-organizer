package com.lifeorganizer.birthdays;

import com.lifeorganizer.auth.*;
import com.lifeorganizer.push.PushService;
import com.lifeorganizer.notifications.BirthdayNotificationRepository;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:birthdays;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver", "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop", "firebase.service-account-path=/nonexistent/test-firebase.json",
    "app.birthdays.cron=-"
})
@AutoConfigureMockMvc
class BirthdayIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired UserRepository users;
    @Autowired JwtService jwt;
    @Autowired BirthdayService service;
    @Autowired BirthdayDeliveryService delivery;
    @Autowired BirthdayRepository reminders;
    @Autowired BirthdayDeliveryRepository deliveries;
    @Autowired BirthdayNotificationRepository notifications;
    @MockitoBean PushService push;

    User owner, partner;
    @BeforeEach void prepare() {
        notifications.deleteAllInBatch(); deliveries.deleteAllInBatch(); reminders.deleteAllInBatch();
        owner = users.findByRole(Role.OWNER).orElseThrow();
        partner = users.findByRole(Role.RECIPIENT).orElseThrow();
        owner.setFcmToken("owner-device"); partner.setFcmToken("partner-device");
        users.saveAll(List.of(owner, partner));
        when(push.sendToUser(any(User.class), anyString(), anyString(), anyMap())).thenReturn(true);
    }
    String auth(User user) { return "Bearer " + jwt.generateToken(user); }
    String body(String label, int month, int day) {
        return "{\"label\":\"%s\",\"month\":%d,\"day\":%d,\"timeZone\":\"Africa/Casablanca\"}".formatted(label, month, day);
    }
    UUID create(User user, int month, int day) {
        return service.create(user, new BirthdayRequest("Sister's birthday", month, day, "Africa/Casablanca")).id();
    }
    @Test void bothAccountsHavePrivateListsAndCannotModifyEachOthersBirthdays() throws Exception {
        for (User user : List.of(owner, partner)) {
            mvc.perform(post("/api/birthdays").header("Authorization", auth(user)).contentType("application/json").content(body(user.getRole().name(), 10, 20)))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.label").value(user.getRole().name()))
                .andExpect(jsonPath("$.userId").doesNotExist()).andExpect(jsonPath("$.timeZone").value("Africa/Casablanca"));
            mvc.perform(get("/api/birthdays").header("Authorization", auth(user)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].label").value(user.getRole().name()));
        }
        UUID ownerId = reminders.findByUserId(owner.getId()).getFirst().getId();
        mvc.perform(put("/api/birthdays/"+ownerId).header("Authorization", auth(partner)).contentType("application/json").content(body("Stolen", 1, 1))).andExpect(status().isNotFound());
        mvc.perform(delete("/api/birthdays/"+ownerId).header("Authorization", auth(partner))).andExpect(status().isNotFound());
        mvc.perform(put("/api/birthdays/"+ownerId).header("Authorization", auth(owner)).contentType("application/json").content(body("  Mum's birthday  ", 2, 29)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.label").value("Mum's birthday")).andExpect(jsonPath("$.day").value(29));
        mvc.perform(delete("/api/birthdays/"+ownerId).header("Authorization", auth(owner))).andExpect(status().isNoContent());
        assertThat(service.list(owner)).isEmpty(); assertThat(service.list(partner)).hasSize(1);
    }
    @Test void invalidDatesLabelsAndZonesAreRejectedAndAuthenticationIsRequired() throws Exception {
        for (String input : List.of(body("Invalid",2,30),body("Invalid",4,31),body(" ",1,1),body("Invalid",13,1),body("Invalid",1,0),body("x".repeat(101),1,1),"{}",body("Invalid",1,1).replace("Africa/Casablanca","Not/AZone"))) {
            mvc.perform(post("/api/birthdays").header("Authorization",auth(owner)).contentType("application/json").content(input)).andExpect(status().isBadRequest());
        }
        mvc.perform(get("/api/birthdays")).andExpect(status().is4xxClientError());
        mvc.perform(post("/api/birthdays").contentType("application/json").content(body("No access",1,1))).andExpect(status().is4xxClientError());
        assertThat(reminders.count()).isZero();
    }
    @Test void annualDatesHandleTodayYearRolloverAndLeapBirthdays() {
        assertThat(BirthdayDates.nextOccurrence(1,1,LocalDate.of(2026,12,30))).isEqualTo("2027-01-01");
        assertThat(BirthdayDates.nextOccurrence(10,16,LocalDate.of(2026,10,16))).isEqualTo("2026-10-16");
        assertThat(BirthdayDates.nextOccurrence(2,29,LocalDate.of(2027,2,25))).isEqualTo("2027-02-28");
        assertThat(BirthdayDates.nextOccurrence(2,29,LocalDate.of(2028,2,25))).isEqualTo("2028-02-29");
        assertThat(BirthdayDates.nextOccurrence(2,29,LocalDate.of(2027,3,1))).isEqualTo("2028-02-29");
    }
    @Test void moroccoUsesGmtAfterSeptemberChangeEvenWithOldJvmTimeZoneData() {
        assertThat(MoroccoTime.zone("Africa/Casablanca",Instant.parse("2026-10-16T19:00:00Z"))).isEqualTo(ZoneOffset.UTC);
        assertThat(MoroccoTime.zone("Africa/Casablanca",Instant.parse("2026-08-01T19:00:00Z"))).isEqualTo(ZoneId.of("Africa/Casablanca"));
        assertThat(MoroccoTime.zone("Asia/Tokyo",Instant.parse("2026-10-16T19:00:00Z"))).isEqualTo(ZoneId.of("Asia/Tokyo"));
    }
    @Test void remindersSendAtSevenPmThreeAndOneDaysBeforeOnlyToTheirOwner() {
        UUID id=create(owner,10,20);
        delivery.deliver(id,Instant.parse("2026-10-17T18:59:59Z")); verifyNoInteractions(push);
        delivery.deliver(id,Instant.parse("2026-10-17T19:00:00Z"));
        delivery.deliver(id,Instant.parse("2026-10-17T22:00:00Z"));
        delivery.deliver(id,Instant.parse("2026-10-18T19:00:00Z"));
        delivery.deliver(id,Instant.parse("2026-10-19T19:00:00Z"));
        delivery.deliver(id,Instant.parse("2026-10-20T19:00:00Z"));
        verify(push).sendToUser(argThat(u -> u.getId().equals(owner.getId())),eq("Birthday reminder"),eq("“Sister's birthday” is in 3 days."),argThat(data -> data.get("route").equals("/notifications")));
        verify(push).sendToUser(argThat(u -> u.getId().equals(owner.getId())),eq("Birthday reminder"),eq("“Sister's birthday” is in 1 day."),anyMap());
        verifyNoMoreInteractions(push); assertThat(deliveries.count()).isEqualTo(2);
        service.delete(owner,id); assertThat(deliveries.count()).isZero();
        delivery.deliver(id,Instant.parse("2026-10-19T20:00:00Z")); verifyNoMoreInteractions(push);
    }
    @Test void failedPushIsRetriedButSuccessIsRememberedAcrossLaterRunsAndEdits() {
        UUID id=create(partner,10,20);
        when(push.sendToUser(any(),anyString(),anyString(),anyMap())).thenReturn(false,true);
        delivery.deliver(id,Instant.parse("2026-10-17T19:00:00Z")); assertThat(deliveries.count()).isZero();
        delivery.deliver(id,Instant.parse("2026-10-17T19:05:00Z")); assertThat(deliveries.count()).isEqualTo(1);
        service.update(partner,id,new BirthdayRequest("Renamed",10,20,"Africa/Casablanca"));
        delivery.deliver(id,Instant.parse("2026-10-17T19:10:00Z"));
        verify(push,times(2)).sendToUser(argThat(u -> u.getId().equals(partner.getId())),anyString(),anyString(),anyMap());
    }
    @Test void reminderRepeatsNextYearAndHandlesNewYear() {
        UUID id=create(owner,1,1);
        delivery.deliver(id,Instant.parse("2026-12-29T19:00:00Z"));
        delivery.deliver(id,Instant.parse("2026-12-31T19:00:00Z"));
        delivery.deliver(id,Instant.parse("2027-12-29T19:00:00Z"));
        delivery.deliver(id,Instant.parse("2027-12-31T19:00:00Z"));
        assertThat(deliveries.count()).isEqualTo(4); verify(push,times(4)).sendToUser(any(),anyString(),anyString(),anyMap());
    }
    @Test void overlappingWorkersDoNotSendTheSameReminderTwice() throws Exception {
        UUID id=create(owner,10,20);
        when(push.sendToUser(any(),anyString(),anyString(),anyMap())).thenAnswer(invocation -> { Thread.sleep(100); return true; });
        try (var executor=Executors.newFixedThreadPool(2)) {
            var a=executor.submit(() -> delivery.deliver(id,Instant.parse("2026-10-17T19:00:00Z")));
            var b=executor.submit(() -> delivery.deliver(id,Instant.parse("2026-10-17T19:00:00Z")));
            a.get(10,TimeUnit.SECONDS); b.get(10,TimeUnit.SECONDS);
        }
        verify(push).sendToUser(any(),anyString(),anyString(),anyMap()); assertThat(deliveries.count()).isEqualTo(1);
        assertThat(notifications.count()).isEqualTo(1);
    }
    @Test void inboxIsPrivateNewestFirstAndOtherUsersCannotDeleteMessages() throws Exception {
        UUID ownerBirthday = create(owner,10,20);
        UUID partnerBirthday = create(partner,10,20);
        delivery.deliver(ownerBirthday,Instant.parse("2026-10-17T18:59:59Z"));
        assertThat(notifications.count()).isZero();
        delivery.deliver(ownerBirthday,Instant.parse("2026-10-17T19:00:00Z"));
        delivery.deliver(ownerBirthday,Instant.parse("2026-10-19T19:00:00Z"));
        delivery.deliver(partnerBirthday,Instant.parse("2026-10-17T19:00:00Z"));
        mvc.perform(get("/api/notifications")).andExpect(status().is4xxClientError());
        mvc.perform(get("/api/notifications").header("Authorization",auth(owner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].body").value("“Sister's birthday” is in 1 day."))
            .andExpect(jsonPath("$[1].body").value("“Sister's birthday” is in 3 days."))
            .andExpect(jsonPath("$[0].createdAt").value("2026-10-19T19:00:00Z"));
        UUID message = notifications.findByUserIdAndDismissedFalseOrderByCreatedAtDescIdDesc(owner.getId()).getFirst().getId();
        mvc.perform(delete("/api/notifications/"+message)).andExpect(status().is4xxClientError());
        mvc.perform(delete("/api/notifications/"+message).header("Authorization",auth(partner))).andExpect(status().isNotFound());
        mvc.perform(get("/api/notifications").header("Authorization",auth(partner)))
            .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(delete("/api/notifications/"+message).header("Authorization",auth(owner))).andExpect(status().isNoContent());
        mvc.perform(get("/api/notifications").header("Authorization",auth(owner))).andExpect(jsonPath("$.length()").value(1));
        mvc.perform(delete("/api/notifications/"+message).header("Authorization",auth(owner))).andExpect(status().isNotFound());
        assertThat(service.list(owner)).hasSize(1);
    }
    @Test void deletingAnInboxMessageDoesNotResendItAndFutureReminderStillArrives() throws Exception {
        UUID birthday = create(partner,10,20);
        delivery.deliver(birthday,Instant.parse("2026-10-17T19:00:00Z"));
        UUID message = notifications.findByUserIdAndDismissedFalseOrderByCreatedAtDescIdDesc(partner.getId()).getFirst().getId();
        mvc.perform(delete("/api/notifications/"+message).header("Authorization",auth(partner))).andExpect(status().isNoContent());
        delivery.deliver(birthday,Instant.parse("2026-10-17T20:00:00Z"));
        mvc.perform(get("/api/notifications").header("Authorization",auth(partner))).andExpect(jsonPath("$.length()").value(0));
        verify(push,times(1)).sendToUser(any(),anyString(),anyString(),anyMap());
        delivery.deliver(birthday,Instant.parse("2026-10-19T19:00:00Z"));
        mvc.perform(get("/api/notifications").header("Authorization",auth(partner)))
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].body").value("“Sister's birthday” is in 1 day."));
        service.update(partner,birthday,new BirthdayRequest("Changed label",10,20,"Africa/Casablanca"));
        service.delete(partner,birthday);
        mvc.perform(get("/api/notifications").header("Authorization",auth(partner)))
            .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].body").value("“Sister's birthday” is in 1 day."));
    }
    @Test void inboxArrivesEvenWhenPushFailsAndDismissedMessageStaysDeletedDuringRetries() throws Exception {
        UUID birthday = create(owner,10,20);
        when(push.sendToUser(any(),anyString(),anyString(),anyMap())).thenReturn(false,true);
        delivery.deliver(birthday,Instant.parse("2026-10-17T19:00:00Z"));
        assertThat(deliveries.count()).isZero();
        UUID message = notifications.findByUserIdAndDismissedFalseOrderByCreatedAtDescIdDesc(owner.getId()).getFirst().getId();
        mvc.perform(delete("/api/notifications/"+message).header("Authorization",auth(owner))).andExpect(status().isNoContent());
        delivery.deliver(birthday,Instant.parse("2026-10-17T19:05:00Z"));
        assertThat(deliveries.count()).isEqualTo(1); assertThat(notifications.count()).isEqualTo(1);
        mvc.perform(get("/api/notifications").header("Authorization",auth(owner))).andExpect(jsonPath("$.length()").value(0));
    }
    @Test void pushTokenRefreshIsAccountScopedAndSharedPhoneTransfersToCurrentAccount() throws Exception {
        mvc.perform(put("/api/auth/push-token").header("Authorization",auth(partner)).contentType("application/json").content("{\"token\":\"owner-device\"}"))
            .andExpect(status().isNoContent());
        assertThat(users.findById(partner.getId()).orElseThrow().getFcmToken()).isEqualTo("owner-device");
        assertThat(users.findById(owner.getId()).orElseThrow().getFcmToken()).isNull();
        mvc.perform(put("/api/auth/push-token").header("Authorization",auth(owner)).contentType("application/json").content("{\"token\":\" \"}"))
            .andExpect(status().isBadRequest());
        mvc.perform(delete("/api/auth/push-token").header("Authorization",auth(partner))).andExpect(status().isNoContent());
        assertThat(users.findById(partner.getId()).orElseThrow().getFcmToken()).isNull();
    }
}
