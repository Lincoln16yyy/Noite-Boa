package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

import java.time.OffsetDateTime;

/**
 * Issue #99: registros sobrepostos, no futuro ou antigos demais devem ser
 * rejeitados. Usa datas relativas ao "agora" para não envelhecer com o tempo.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SleepLogOverlapTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @AfterEach
    void cleanup() {
        // Contas de teste e seus dados (cascade). Sem deleteAll() global (#269).
        br.dev.noiteboa.support.LimpezaDeTeste.limpar(userRepository);
    }

    private String token(String email) throws Exception {
        String register = "{\"displayName\":\"Lincoln\",\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(register));
        String login = "{\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        MvcResult res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(login))
            .andExpect(status().isOk())
            .andReturn();
        String json = res.getResponse().getContentAsString();
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build().readTree(json).get("accessToken").asText();
    }

    private OffsetDateTime hoursAgo(int hours) {
        return OffsetDateTime.now().minusHours(hours);
    }

    private String body(OffsetDateTime start, OffsetDateTime end) {
        return "{\"sleepStart\":\"" + start + "\",\"sleepEnd\":\"" + end + "\",\"quality\":4}";
    }

    private String create(String token, OffsetDateTime start, OffsetDateTime end) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(start, end)))
            .andExpect(status().isCreated()).andReturn();
        String json = res.getResponse().getContentAsString();
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build().readTree(json).get("id").asText();
    }

    // ---- sobreposição na criação ----

    @Test
    void partialOverlapReturns409() throws Exception {
        String token = token("overlap1@example.com");
        create(token, hoursAgo(26), hoursAgo(18)); // noite existente: -26h → -18h

        // Sobreposição parcial: -20h → -12h (cruza o fim da existente)
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(hoursAgo(20), hoursAgo(12))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").value("Este período se sobrepõe a um registro existente."));
    }

    @Test
    void newRecordInsideExistingReturns409() throws Exception {
        String token = token("overlap2@example.com");
        create(token, hoursAgo(26), hoursAgo(18));

        // Novo registro contido na existente: -24h → -20h
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(hoursAgo(24), hoursAgo(20))))
            .andExpect(status().isConflict());
    }

    @Test
    void newRecordContainingExistingReturns409() throws Exception {
        String token = token("overlap3@example.com");
        create(token, hoursAgo(26), hoursAgo(18));

        // Novo registro engloba a existente: -30h → -10h
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(hoursAgo(30), hoursAgo(10))))
            .andExpect(status().isConflict());
    }

    @Test
    void adjacentRecordsAreAllowed() throws Exception {
        String token = token("overlap4@example.com");
        OffsetDateTime fimExistente = hoursAgo(18);
        create(token, hoursAgo(26), fimExistente);

        // Adjacente: começa exatamente onde a outra termina (fim == início é permitido)
        create(token, fimExistente, hoursAgo(10));
    }

    @Test
    void overlapIsPerUserOnly() throws Exception {
        String tokenA = token("overlap5a@example.com");
        String tokenB = token("overlap5b@example.com");
        create(tokenA, hoursAgo(26), hoursAgo(18));

        // Mesmo período, outro usuário: não é sobreposição
        create(tokenB, hoursAgo(26), hoursAgo(18));
    }

    // ---- sobreposição na edição ----

    @Test
    void updateOverlappingAnotherReturns409() throws Exception {
        String token = token("overlap6@example.com");
        create(token, hoursAgo(26), hoursAgo(18)); // existente A
        String idB = create(token, hoursAgo(16), hoursAgo(8)); // existente B

        // Editar B para sobrepor A: -20h → -12h
        mockMvc.perform(put("/api/sleep-logs/" + idB).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(hoursAgo(20), hoursAgo(12))))
            .andExpect(status().isConflict());
    }

    @Test
    void updateKeepingOwnPeriodReturns200() throws Exception {
        String token = token("overlap7@example.com");
        create(token, hoursAgo(26), hoursAgo(18));
        OffsetDateTime inicioB = hoursAgo(16);
        OffsetDateTime fimB = hoursAgo(8);
        String idB = create(token, inicioB, fimB);

        // Editar B mantendo o próprio período (só muda a nota): não pode conflitar consigo mesma
        mockMvc.perform(put("/api/sleep-logs/" + idB).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"sleepStart\":\"" + inicioB + "\",\"sleepEnd\":\"" + fimB + "\",\"quality\":5,\"notes\":\"atualizado\"}"))
            .andExpect(status().isOk());
    }

    // ---- datas fora do intervalo permitido ----

    @Test
    void sleepEndInFutureReturns400() throws Exception {
        String token = token("futuro@example.com");
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(body(hoursAgo(8), OffsetDateTime.now().plusHours(1))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("sleepEnd não pode estar no futuro"));
    }

    @Test
    void sleepEndWithinToleranceIsAllowed() throws Exception {
        String token = token("futuro-ok@example.com");
        // Fim "no futuro" mas dentro da tolerância de 5 minutos: permitido
        create(token, hoursAgo(8), OffsetDateTime.now().plusMinutes(2));
    }

    @Test
    void sleepStartOlderThanOneYearReturns400() throws Exception {
        String token = token("antigo@example.com");
        OffsetDateTime antigo = OffsetDateTime.now().minusDays(400);
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body(antigo, antigo.plusHours(8))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.detail").value("sleepStart não pode ser anterior a 1 ano"));
    }
}
