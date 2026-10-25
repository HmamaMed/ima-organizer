package com.lifeorganizer.agios;

import com.lifeorganizer.auth.Role;
import com.lifeorganizer.auth.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Real HTTP validation, role access, decimal persistence and shared account attribution. */
@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:agios;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa", "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "firebase.service-account-path=/nonexistent/test-firebase.json"
})
@AutoConfigureMockMvc
@Transactional
class AgiosIntegrationTests {
    @Autowired MockMvc mvc;
    @Autowired AgioRepository agios;
    @Autowired UserRepository users;

    private UUID account(Role role) { return users.findByRole(role).orElseThrow().getId(); }

    private String input(UUID userId, String amount, String date) {
        return """
                {"userId":"%s","amount":"%s","date":"%s"}
                """.formatted(userId, amount, date);
    }

    @Test
    @WithMockUser(roles = "OWNER")
    void ownerCanAddForEitherPersonAndReadExactAmountsInDateOrder() throws Exception {
        UUID owner = account(Role.OWNER), partner = account(Role.RECIPIENT);
        mvc.perform(post("/api/agios").contentType("application/json")
                        .content(input(owner, "0.10", "2025-12-31")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value("0.10"))
                .andExpect(jsonPath("$.userId").value(owner.toString()));
        mvc.perform(post("/api/agios").contentType("application/json")
                        .content(input(partner, "125.55", "2026-01-01")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value("125.55"))
                .andExpect(jsonPath("$.userId").value(partner.toString()));
        agios.flush();
        assertThat(agios.findAllByOrderByDateDescCreatedAtDesc().getFirst().getAmount().toPlainString()).isEqualTo("125.55");
        mvc.perform(get("/api/agios")).andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(2))
                .andExpect(jsonPath("$.participants[0].userId").value(owner.toString()))
                .andExpect(jsonPath("$.participants[1].userId").value(partner.toString()))
                .andExpect(jsonPath("$.participants[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.participants[0].fcmToken").doesNotExist())
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].date").value("2026-01-01"))
                .andExpect(jsonPath("$.entries[1].amount").value("0.10"));
    }

    @Test
    @WithMockUser(roles = "RECIPIENT")
    void recipientCanReadAddEditAndDeleteSharedEntriesWithoutMovingAccounts() throws Exception {
        UUID owner = account(Role.OWNER), partner = account(Role.RECIPIENT);
        String today = LocalDate.now().toString();
        mvc.perform(get("/api/agios")).andExpect(status().isOk())
                .andExpect(jsonPath("$.participants.length()").value(2))
                .andExpect(jsonPath("$.entries.length()").value(0));
        for (UUID userId : new UUID[]{ owner, partner }) {
            mvc.perform(post("/api/agios").contentType("application/json")
                            .content(input(userId, "25", today)))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value("25.00"));
        }
        Agio entry = agios.findAll().stream().filter(a -> a.getUser().getId().equals(owner)).findFirst().orElseThrow();
        mvc.perform(put("/api/agios/" + entry.getId()).contentType("application/json")
                        .content(input(partner, "30.20", "2025-12-01")))
                .andExpect(status().isConflict());
        mvc.perform(put("/api/agios/" + entry.getId()).contentType("application/json")
                        .content(input(owner, "30.20", "2025-12-01")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value("30.20"))
                .andExpect(jsonPath("$.date").value("2025-12-01"))
                .andExpect(jsonPath("$.userId").value(owner.toString()));
        mvc.perform(delete("/api/agios/" + entry.getId())).andExpect(status().isNoContent());
        assertThat(agios.findAll()).hasSize(1);
        assertThat(agios.findAll().getFirst().getUser().getId()).isEqualTo(partner);
    }

    @Test
    @WithMockUser(roles = "OWNER")
    void invalidAmountsDatesAndMissingFieldsCannotBePersisted() throws Exception {
        UUID owner = account(Role.OWNER);
        for (String amount : new String[]{"0", "-0.00", "0.001", "-0.001", "12.345", "1000000000000", "-1000000000000"}) {
            mvc.perform(post("/api/agios").contentType("application/json")
                            .content(input(owner, amount, "2025-01-01")))
                    .andExpect(status().isBadRequest());
        }
        for (String body : new String[]{ "{}", "{\"userId\":\"" + owner + "\",\"amount\":1}",
                input(owner, "1.00", LocalDate.now().plusDays(1).toString()),
                input(owner, "1.00", "not-a-date") }) {
            mvc.perform(post("/api/agios").contentType("application/json").content(body))
                    .andExpect(status().isBadRequest());
        }
        assertThat(agios.count()).isZero();
    }

    @Test
    @WithMockUser(roles = "OWNER")
    void threeInterestCreditsAndWithdrawalLeaveOneHundredWithoutDeletingHistory() throws Exception {
        UUID owner = account(Role.OWNER), partner = account(Role.RECIPIENT);
        for (int day = 3; day >= 1; day--) {
            mvc.perform(post("/api/agios").contentType("application/json")
                            .content(input(owner, "100.00", LocalDate.now().minusDays(day).toString())))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/agios").contentType("application/json")
                        .content(input(partner, "75.40", LocalDate.now().toString())))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/agios").contentType("application/json")
                        .content(input(owner, "-200.00", LocalDate.now().toString())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value("-200.00"))
                .andExpect(jsonPath("$.userId").value(owner.toString()));
        agios.flush();
        var ownerEntries = agios.findAll().stream().filter(a -> a.getUser().getId().equals(owner)).toList();
        assertThat(ownerEntries).hasSize(4);
        assertThat(ownerEntries.stream().map(Agio::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add))
                .isEqualByComparingTo("100.00");
        assertThat(ownerEntries.stream().filter(a -> a.getAmount().signum() > 0)).hasSize(3);
        mvc.perform(get("/api/agios")).andExpect(status().isOk())
                .andExpect(jsonPath("$.entries.length()").value(5));
    }

    @Test
    @WithMockUser(roles = "RECIPIENT")
    void recipientCanRecordAndCorrectWithdrawalsForEitherPersonIncludingFractionalAmounts() throws Exception {
        for (Role role : java.util.List.of(Role.OWNER, Role.RECIPIENT)) {
            UUID userId = account(role);
            mvc.perform(post("/api/agios").contentType("application/json")
                            .content(input(userId, "25.00", LocalDate.now().toString())))
                    .andExpect(status().isCreated());
            mvc.perform(post("/api/agios").contentType("application/json")
                            .content(input(userId, "-0.50", LocalDate.now().toString())))
                    .andExpect(status().isCreated()).andExpect(jsonPath("$.amount").value("-0.50"));
        }
        Agio withdrawal = agios.findAll().stream().filter(a -> a.getAmount().signum() < 0).findFirst().orElseThrow();
        mvc.perform(put("/api/agios/" + withdrawal.getId()).contentType("application/json")
                        .content(input(withdrawal.getUser().getId(), "-5.25", LocalDate.now().toString())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.amount").value("-5.25"));
        mvc.perform(delete("/api/agios/" + withdrawal.getId())).andExpect(status().isNoContent());
        assertThat(agios.findAll().stream().filter(a -> a.getAmount().signum() > 0)).hasSize(2);
        assertThat(agios.count()).isEqualTo(3);
    }

    @Test
    @WithMockUser(roles = "RECIPIENT")
    void unknownAccountsAndEntriesReturnNotFound() throws Exception {
        UUID missing = UUID.randomUUID();
        mvc.perform(post("/api/agios").contentType("application/json")
                        .content(input(missing, "12.00", "2025-01-01")))
                .andExpect(status().isNotFound());
        mvc.perform(put("/api/agios/" + missing).contentType("application/json")
                        .content(input(account(Role.RECIPIENT), "12.00", "2025-01-01")))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/api/agios/" + missing)).andExpect(status().isNotFound());
        assertThat(agios.count()).isZero();
    }

    @Test
    void anonymousCannotReadOrChangeAgios() throws Exception {
        mvc.perform(get("/api/agios")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/agios").contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/agios/" + UUID.randomUUID()).contentType("application/json").content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/agios/" + UUID.randomUUID())).andExpect(status().isUnauthorized());
    }
}
