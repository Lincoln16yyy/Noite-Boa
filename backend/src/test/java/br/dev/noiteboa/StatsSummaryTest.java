package br.dev.noiteboa;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.auth.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class StatsSummaryTest {

    // O serviço calcula "hoje/ontem" no fuso do perfil (padrão America/Sao_Paulo).
    // O teste precisa montar as datas no mesmo fuso, senão o resultado muda com o
    // fuso da máquina (CI em UTC quebrava entre 00h e 03h UTC).
    private static final java.time.ZoneId FUSO_PERFIL = java.time.ZoneId.of("America/Sao_Paulo");

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired br.dev.noiteboa.sleep.SleepLogRepository sleepLogRepository;

    @AfterEach
    void cleanup() {
        sleepLogRepository.deleteAll();
        userRepository.findAll().stream().filter(u -> u.getEmail().endsWith("@example.com")).forEach(userRepository::delete);
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

    private void create(String token, String start, String end, int quality) throws Exception {
        String body = "{\"sleepStart\":\"" + start + "\",\"sleepEnd\":\"" + end + "\",\"quality\":" + quality + "}";
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
    }

    @Test
    void summaryIsOkAndReturnsDailySeries() throws Exception {
        String token = token("stats@example.com");
        create(token, "2026-10-06T22:00:00Z", "2026-10-07T06:00:00Z", 4);
        create(token, "2026-10-07T22:00:00Z", "2026-10-08T06:00:00Z", 5);

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.days").value(7))
            .andExpect(jsonPath("$.averageHours").value(8.0))
            .andExpect(jsonPath("$.daily").isArray());
    }

    @Test
    void daysMustBe7Or30() throws Exception {
        String token = token("stats2@example.com");
        mockMvc.perform(get("/api/stats/summary?days=15").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
    }

    @Test
    void noDataReturnsZeroedSummary() throws Exception {
        String token = token("stats3@example.com");
        mockMvc.perform(get("/api/stats/summary?days=30").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.averageHours").value(0.0))
            .andExpect(jsonPath("$.sleepDebtMinutes").value(0));
    }

    @Test
    void deletedAccountGetsFast401OnSummary() throws Exception {
        String token = token("stats-deletado@example.com");
        mockMvc.perform(delete("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        // Um usuário inexistente deve receber 401 rápido. Hoje (retry do #133) a
        // chamada espera ~600ms e vira 500 "Falha após 3 tentativas".
        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());

        long start = System.nanoTime();
        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;
        assertTrue(elapsedMs < 100, "401 de usuário inexistente deveria ser rápido; levou " + elapsedMs + "ms");
    }

    @Test
    void sleepDebtWithSingleNightYesterdayIsZero() throws Exception {
        String token = token("stats4@example.com");
        // Registra uma noite de 8h ontem. Fim às 00:00Z do dia seguinte (não 06:00Z)
        // para a noite ficar sempre no passado — validação da #99 rejeita fim futuro.
        var yesterday = java.time.LocalDate.now(FUSO_PERFIL).minusDays(1);
        create(token, yesterday.atTime(16, 0).toString() + "Z", yesterday.plusDays(1).atTime(0, 0).toString() + "Z", 4);

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sleepDebtMinutes").value(0));
    }

    @Test
    void sleepDebtPerfectWeekIsZero() throws Exception {
        String token = token("stats5@example.com");
        // Registra 7 noites de 8h cada (últimos 7 dias)
        for (int i = 6; i >= 0; i--) {
            var date = java.time.LocalDate.now(FUSO_PERFIL).minusDays(i + 1); // ontem até 7 dias atrás
            create(token, date.atTime(16, 0).toString() + "Z", date.plusDays(1).atTime(0, 0).toString() + "Z", 4);
        }

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sleepDebtMinutes").value(0));
    }

    @Test
    void sleepDebtWithTwoMissedDays() throws Exception {
        String token = token("stats6@example.com");
        // Registra 5 noites de 8h, pula 2 dias
        for (int i = 6; i >= 2; i--) {
            var date = java.time.LocalDate.now(FUSO_PERFIL).minusDays(i + 1);
            create(token, date.atTime(16, 0).toString() + "Z", date.plusDays(1).atTime(0, 0).toString() + "Z", 4);
        }
        // Dias 0 e 1 (ontem e anteontem) sem registro

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sleepDebtMinutes").value(960)); // 2 dias * 480 min
    }

    @Test
    void sleepDebtCountsMissedDaysWhenHistoryIsOlderThanWindow() throws Exception {
        String token = token("stats7@example.com");
        // Histórico antigo, fora da janela de 7 dias (antes de hoje-6).
        var antigo = java.time.LocalDate.now(FUSO_PERFIL).minusDays(10);
        create(token, antigo.atTime(16, 0).toString() + "Z", antigo.plusDays(1).atTime(0, 0).toString() + "Z", 4);

        // Nada registrado nos últimos 7 dias. Com a regra antiga (primeiro
        // registro só da janela), a dívida virava 0. Agora a janela de cálculo
        // começa no histórico do usuário, então os 6 dias (hoje-6 a ontem) sem
        // registro contam como dívida cheia: 6 * 480 = 2880.
        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sleepDebtMinutes").value(2880));
    }
}
