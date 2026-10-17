package br.dev.noiteboa;

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
class SleepLogListTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

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

    private void createLog(String token, String start, String end, int quality) throws Exception {
        String body = "{\"sleepStart\":\"" + start + "\",\"sleepEnd\":\"" + end + "\",\"quality\":" + quality + "}";
        mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
    }

    @Test
    void listReturnsOnlyOwnLogsAndPaginates() throws Exception {
        String tokenA = token("a@example.com");
        String tokenB = token("b@example.com");
        createLog(tokenA, "2026-10-01T22:00:00Z", "2026-10-02T06:00:00Z", 4);
        createLog(tokenA, "2026-10-02T22:00:00Z", "2026-10-03T06:00:00Z", 5);
        createLog(tokenB, "2026-10-02T22:00:00Z", "2026-10-03T06:00:00Z", 3);

        mockMvc.perform(get("/api/sleep-logs?page=0&size=10").header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(2))
            .andExpect(jsonPath("$.totalElements").value(2));

        mockMvc.perform(get("/api/sleep-logs?page=0&size=1").header("Authorization", "Bearer " + tokenA))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content.length()").value(1))
            .andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void fromToFilterWorks() throws Exception {
        String token = token("c@example.com");
        createLog(token, "2026-10-01T22:00:00Z", "2026-10-02T06:00:00Z", 4);
        createLog(token, "2026-10-10T22:00:00Z", "2026-10-11T06:00:00Z", 5);

        mockMvc.perform(get("/api/sleep-logs?from=2026-10-05T00:00:00Z&to=2026-10-20T00:00:00Z")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1));
    }

    // Issue #96: validação de parâmetros de paginação e intervalo
    @Test
    void pageNegativoRetorna400() throws Exception {
        String token = token("d@example.com");
        mockMvc.perform(get("/api/sleep-logs?page=-1").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
    }

    @Test
    void sizeZeroRetorna400() throws Exception {
        String token = token("e@example.com");
        mockMvc.perform(get("/api/sleep-logs?size=0").header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
    }

    @Test
    void sizeAcimaDe100EhLimitadoA100() throws Exception {
        String token = token("f@example.com");
        createLog(token, "2026-10-01T22:00:00Z", "2026-10-02T06:00:00Z", 4);
        mockMvc.perform(get("/api/sleep-logs?size=1000").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pageable.pageSize").value(100));
    }

    @Test
    void fromMaiorQueToRetorna400() throws Exception {
        String token = token("g@example.com");
        mockMvc.perform(get("/api/sleep-logs?from=2026-10-20T00:00:00Z&to=2026-10-05T00:00:00Z")
                .header("Authorization", "Bearer " + token))
            .andExpect(status().isBadRequest());
    }
}
