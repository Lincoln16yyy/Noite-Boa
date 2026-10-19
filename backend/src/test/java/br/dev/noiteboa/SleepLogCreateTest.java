package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class SleepLogCreateTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @Autowired
    br.dev.noiteboa.sleep.SleepLogRepository sleepLogRepository;

    @AfterEach
    void cleanup() {
        // Só contas de teste (@example.com). Antes havia sleepLogRepository.deleteAll(),
        // que apagava as noites do banco de desenvolvimento inteiro (#269).
        br.dev.noiteboa.support.LimpezaDeTeste.limpar(userRepository);
    }

    /**
     * Corpo de uma noite válida terminada 2h atrás. Datas relativas a agora, e não
     * fixas: a validação recusa início no futuro e com mais de 365 dias, então
     * data de calendário envelhece e passa a testar outra coisa (review do PR #284).
     */
    private String corpoValido() {
        return "{\"sleepStart\":\"" + emHoras(10) + "\",\"sleepEnd\":\"" + emHoras(2)
            + "\",\"quality\":4,\"notes\":\"ok\"}";
    }

    /** Instante ISO em UTC de {@code horas} atrás. */
    private static String emHoras(long horas) {
        return java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC).minusHours(horas).toString();
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

    @Test
    void validCreateReturns201AndBelongsToTokenUser() throws Exception {
        String token = token("sono@example.com");
        String body = corpoValido();
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists());

        // Escopado ao dono e sem recorte de janela: o banco pode ter noites de
        // outras contas (dev), e um corte por data esconderia a fixture (#269).
        var dono = userRepository.findByEmailIgnoreCase("sono@example.com").orElseThrow();
        var logs = sleepLogRepository.findByUserIdOrderBySleepStartDesc(dono.getId());
        org.junit.jupiter.api.Assertions.assertEquals(1, logs.size());
        org.junit.jupiter.api.Assertions.assertEquals("sono@example.com", logs.get(0).getUser().getEmail());
    }

    @Test
    void endBeforeStartReturns400() throws Exception {
        String token = token("sono2@example.com");
        String body = "{\"sleepStart\":\"" + emHoras(2) + "\",\"sleepEnd\":\"" + emHoras(10) + "\",\"quality\":4}";
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void qualityOutOfRangeReturns400() throws Exception {
        String token = token("sono3@example.com");
        String body = "{\"sleepStart\":\"" + emHoras(10) + "\",\"sleepEnd\":\"" + emHoras(2) + "\",\"quality\":7}";
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void durationOver24hReturns400() throws Exception {
        String token = token("sono4@example.com");
        String body = "{\"sleepStart\":\"" + emHoras(30) + "\",\"sleepEnd\":\"" + emHoras(2) + "\",\"quality\":4}";
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void noTokenReturns401() throws Exception {
        String body = corpoValido();
        mockMvc.perform(post("/api/sleep-logs").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }
}
