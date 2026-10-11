package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.friends.Friendship;
import br.dev.noiteboa.friends.FriendshipRepository;
import br.dev.noiteboa.sleep.SleepLog;
import br.dev.noiteboa.sleep.SleepLogRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/**
 * Issue #98: estatísticas e ranking consultam só o período, não o histórico
 * inteiro. Teste de equivalência: registros antigos (fora da janela de 7 dias)
 * não entram no cálculo e o resultado para dados dentro da janela é o mesmo
 * de antes (média 8h, 2 dias no "daily", dívida 1920, noites do amigo 3).
 */
@SpringBootTest
@AutoConfigureMockMvc
class StatsAndRankingWindowTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired SleepLogRepository sleepLogRepository;
    @Autowired FriendshipRepository friendshipRepository;

    @AfterEach
    void cleanup() {
        sleepLogRepository.deleteAll();
        friendshipRepository.deleteAll();
        userRepository.findAll().stream()
            .filter(u -> u.getEmail().endsWith("@example.com"))
            .forEach(userRepository::delete);
    }

    private String token(String email) throws Exception {
        String register = "{\"displayName\":\"Lincoln\",\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(register));
        String login = "{\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        MvcResult res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(login))
            .andExpect(status().isOk()).andReturn();
        String json = res.getResponse().getContentAsString();
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build().readTree(json).get("accessToken").asText();
    }

    /** Noite via HTTP: começa às 16hZ de `diasAtras` (sempre no passado). */
    private void createNight(String token, int diasAtras, int horas) throws Exception {
        var start = java.time.LocalDate.now().minusDays(diasAtras).atTime(16, 0);
        String body = "{\"sleepStart\":\"" + start + "Z\",\"sleepEnd\":\"" + start.plusHours(horas) + "Z\",\"quality\":4}";
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
    }

    private User seedUser(String email, String name) {
        User u = new User(UUID.randomUUID(), email, "x", name, OffsetDateTime.now());
        u.setShareWithFriends(true);
        return userRepository.save(u);
    }

    private void seedFriendship(User a, User b) {
        Friendship f = new Friendship(UUID.randomUUID(), a, b);
        f.accept();
        friendshipRepository.save(f);
    }

    /** Noite direto no repositório (16hZ, `diasAtras` dias atrás). */
    private void seedNight(User user, int diasAtras) {
        OffsetDateTime start = OffsetDateTime.now(ZoneOffset.UTC).minusDays(diasAtras)
            .withHour(16).withMinute(0).withSecond(0).withNano(0);
        sleepLogRepository.save(new SleepLog(UUID.randomUUID(), user, start, start.plusHours(8), (short) 4, null));
    }

    @Test
    void summaryIgnoresRecordsOutsideWindowAndKeepsSameResult() throws Exception {
        String token = token("janela-stats@example.com");
        createNight(token, 1, 8);   // ontem: 8h
        createNight(token, 2, 8);   // anteontem: 8h
        createNight(token, 40, 6);  // antigas, 6h — fora da janela de 7 dias
        createNight(token, 42, 6);

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            // só as 2 noites da janela entram: média 8h (não 7h) e 2 dias no "daily"
            .andExpect(jsonPath("$.averageHours").value(8.0))
            .andExpect(jsonPath("$.daily.length()").value(2))
            .andExpect(jsonPath("$.daily[0].date").value(java.time.LocalDate.now().minusDays(2).toString()))
            .andExpect(jsonPath("$.daily[1].date").value(java.time.LocalDate.now().minusDays(1).toString()))
            // dívida: primeira noite registrada é today-2, então a janela de
            // cálculo vai de today-2 a ontem — os dois dias têm 8h: dívida 0.
            // (Se as noites antigas vazassem, firstSleepDate = today-42 e a
            // dívida seria 4 × 480 = 1920.)
            .andExpect(jsonPath("$.sleepDebtMinutes").value(0));
    }

    @Test
    void rankingIgnoresRecordsOutsideWindowAndKeepsSameResult() throws Exception {
        String meuToken = token("janela-eu@example.com");
        User eu = userRepository.findByEmailIgnoreCase("janela-eu@example.com").orElseThrow();
        User amigo = seedUser("janela-amigo@example.com", "Beto");
        seedFriendship(eu, amigo);

        createNight(meuToken, 1, 8);
        createNight(meuToken, 2, 8);
        for (int k = 1; k <= 3; k++) seedNight(amigo, k); // 3 noites na janela
        seedNight(amigo, 40);                             // antigas — fora da janela
        seedNight(amigo, 42);

        mockMvc.perform(get("/api/friends/ranking?days=7").header("Authorization", "Bearer " + meuToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ranking.length()").value(2))
            // Beto: 3 noites contam, as 2 antigas não (senão seriam 5 e 71%)
            .andExpect(jsonPath("$.ranking[0].displayName").value("Beto"))
            .andExpect(jsonPath("$.ranking[0].nights").value(3))
            .andExpect(jsonPath("$.ranking[0].consistencyPercent").value(43))
            .andExpect(jsonPath("$.ranking[1].displayName").value("Lincoln"))
            .andExpect(jsonPath("$.ranking[1].nights").value(2))
            .andExpect(jsonPath("$.ranking[1].consistencyPercent").value(29));
    }
}
