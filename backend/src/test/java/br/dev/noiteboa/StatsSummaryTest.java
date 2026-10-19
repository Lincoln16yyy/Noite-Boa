package br.dev.noiteboa;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.support.TesteComBanco;
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
class StatsSummaryTest extends TesteComBanco {

    // O serviço calcula "hoje/ontem" no fuso do perfil (padrão America/Sao_Paulo).
    // O teste precisa montar as datas no mesmo fuso, senão o resultado muda com o
    // fuso da máquina (CI em UTC quebrava entre 00h e 03h UTC).
    private static final java.time.ZoneId FUSO_PERFIL = java.time.ZoneId.of("America/Sao_Paulo");

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;

    @AfterEach
    void cleanup() {
        // Só contas de teste (@example.com); sem deleteAll() global (#269).
        br.dev.noiteboa.support.LimpezaDeTeste.limpar(userRepository);
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

    /**
     * Noite de `horas` que começa às 16hZ de `diasAtras` dias atrás.
     *
     * Por que 16hZ e não 23hZ: a validação da #99 rejeita `sleepEnd` no
     * futuro (limite de 5 min). Começando às 16hZ e durando até 8h o fim cai
     * até 00hZ do dia seguinte, que é sempre passado — com 23hZ o fim iria até
     * 07h/08hZ e o teste quebraria sozinho entre 03h e 08h UTC (a CI roda
     * perto da virada do dia UTC; o teste `sleepDebtWithSingleNightYesterdayIsZero`
     * já caiu nisso).
     *
     * `diasAtras` deve ficar longe da fronteira da janela, que é
     * `agora - days` (um instante, muda com a hora do dia). Para days=7,
     * 1 a 5 caem sempre na janela atual e 8 a 12 sempre na anterior, seja
     * qual for a hora em que o teste rode; 6 e 7 são ambíguos. Para days=30,
     * o equivalente é 1 a 28 (atual) e 31 a 58 (anterior).
     */
    private void createNightAt(String token, int diasAtras, int horas) throws Exception {
        var start = java.time.LocalDate.now(FUSO_PERFIL).minusDays(diasAtras).atTime(16, 0);
        create(token, start.toString() + "Z", start.plusHours(horas).toString() + "Z", 4);
    }

    @Test
    void summaryIsOkAndReturnsDailySeries() throws Exception {
        String token = token("stats@example.com");
        // Duas noites de 8h DENTRO da janela de 7 dias. Datas relativas: com
        // data fixa o teste quebrava quando a janela passava dela (era
        // 2026-10-06/07; em 14/10 a média caiu para 0 e a CI ficou vermelha).
        var anteontem = java.time.LocalDate.now(FUSO_PERFIL).minusDays(2);
        var ontem = java.time.LocalDate.now(FUSO_PERFIL).minusDays(1);
        create(token, anteontem.atTime(16, 0).toString() + "Z", anteontem.plusDays(1).atTime(0, 0).toString() + "Z", 4);
        create(token, ontem.atTime(16, 0).toString() + "Z", ontem.plusDays(1).atTime(0, 0).toString() + "Z", 5);

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.days").value(7))
            .andExpect(jsonPath("$.averageHours").value(8.0))
            .andExpect(jsonPath("$.daily").isArray());
    }

    @Test
    void previousAverageIsNullWhenThereIsNoNightInThePreviousPeriod() throws Exception {
        String token = token("stats-prev-vazio@example.com");
        // Só a janela atual tem noite: a anterior fica sem nada e o campo vem
        // nulo — "sem comparação", não "piorou".
        createNightAt(token, 1, 8);

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.averageHours").value(8.0))
            // `previousAverageHours` é anulável (#206): no fio do JSON ele
            // aparece como null explícito, não omitido. JsonPath sozinho não
            // distingue os dois (doesNotExist passa para os dois), por isso
            // a checagem no corpo cru.
            .andExpect(content().string(org.hamcrest.Matchers.containsString("\"previousAverageHours\":null")));
    }

    @Test
    void previousAverageComparesWithTheImmediatelyPreviousPeriod() throws Exception {
        String token = token("stats-prev-dois@example.com");
        // 5 noites de 6h na janela anterior (hoje-12 a hoje-8) e 3 de 8h na
        // atual (hoje-3 a hoje-1): a comparação tem de devolver 8.0 e 6.0 —
        // nem 0 (seria "sem dado" mascarado) nem a média dos dois juntos.
        for (int diasAtras = 8; diasAtras <= 12; diasAtras++) createNightAt(token, diasAtras, 6);
        for (int diasAtras = 1; diasAtras <= 3; diasAtras++) createNightAt(token, diasAtras, 8);

        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.averageHours").value(8.0))
            .andExpect(jsonPath("$.previousAverageHours").value(6.0));
    }

    @Test
    void previousAverageComparesThirtyDayWindows() throws Exception {
        String token = token("stats-prev-30@example.com");
        // Mesma ideia em janelas de 30 dias: 6h no período anterior, 8h no atual.
        for (int diasAtras = 32; diasAtras <= 37; diasAtras++) createNightAt(token, diasAtras, 6);
        for (int diasAtras = 1; diasAtras <= 4; diasAtras++) createNightAt(token, diasAtras, 8);

        mockMvc.perform(get("/api/stats/summary?days=30").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.averageHours").value(8.0))
            .andExpect(jsonPath("$.previousAverageHours").value(6.0));
    }

    @Test
    void previousAverageDoesNotChangeWithTheProfileTimezone() throws Exception {
        // A comparação é por instante, não por dia local (#206): o mesmo
        // histórico tem de dar o mesmo resultado em UTC+14 (Pacific/Kiritimati,
        // a maior distância do UTC) e no fuso padrão. Se alguém trocar a
        // janela por contagem de dias no fuso do perfil, a borda anda até 24h
        // e as duas médias divergem.
        String emKiritimati = token("stats-prev-kiritimati@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + emKiritimati)
                .contentType(MediaType.APPLICATION_JSON).content("{\"timezone\":\"Pacific/Kiritimati\"}"))
            .andExpect(status().isOk());
        String noPadrao = token("stats-prev-padrao@example.com");

        for (String tk : java.util.List.of(emKiritimati, noPadrao)) {
            createNightAt(tk, 8, 8); // janela anterior: uma noite de 8h
            createNightAt(tk, 2, 6); // janela atual: uma noite de 6h

            mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + tk))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.averageHours").value(6.0))
                .andExpect(jsonPath("$.previousAverageHours").value(8.0));
        }
    }

    @Test
    void previousAverageIsNullForAUserWhoNeverRegistered() throws Exception {
        String token = token("stats-prev-sem-nada@example.com");
        // Nunca registrou nada: nem a média atual existe (0.0), nem há o que
        // comparar.
        mockMvc.perform(get("/api/stats/summary?days=7").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.averageHours").value(0.0))
            .andExpect(jsonPath("$.previousAverageHours").doesNotExist());
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
