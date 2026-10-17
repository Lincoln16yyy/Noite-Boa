package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.auth.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class SleepLogUpdateDeleteTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired br.dev.noiteboa.sleep.SleepLogRepository sleepLogRepository;

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

    private String create(String token) throws Exception {
        String body = "{\"sleepStart\":\"2026-10-01T22:00:00Z\",\"sleepEnd\":\"2026-10-02T06:00:00Z\",\"quality\":4}";
        MvcResult res = mockMvc.perform(post("/api/sleep-logs").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated()).andReturn();
        String json = res.getResponse().getContentAsString();
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build().readTree(json).get("id").asText();
    }

    @Test
    void ownerCanUpdate() throws Exception {
        String token = token("dono@example.com");
        String id = create(token);
        String body = "{\"sleepStart\":\"2026-10-01T23:00:00Z\",\"sleepEnd\":\"2026-10-02T07:00:00Z\",\"quality\":5,\"notes\":\"atualizado\"}";
        mockMvc.perform(put("/api/sleep-logs/" + id).header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk());
        var log = sleepLogRepository.findById(java.util.UUID.fromString(id)).orElseThrow();
        Assertions.assertEquals((short) 5, log.getQuality());
        Assertions.assertEquals("atualizado", log.getNotes());
    }

    @Test
    void otherUserGets404OnUpdateAndDelete() throws Exception {
        String tokenA = token("a@example.com");
        String tokenB = token("b@example.com");
        String id = create(tokenA);
        String body = "{\"sleepStart\":\"2026-10-01T23:00:00Z\",\"sleepEnd\":\"2026-10-02T07:00:00Z\",\"quality\":5}";
        mockMvc.perform(put("/api/sleep-logs/" + id).header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/sleep-logs/" + id).header("Authorization", "Bearer " + tokenB))
            .andExpect(status().isNotFound());
    }

    @Test
    void deleteReturns204AndRemoves() throws Exception {
        String token = token("c@example.com");
        String id = create(token);
        mockMvc.perform(delete("/api/sleep-logs/" + id).header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());
        Assertions.assertTrue(sleepLogRepository.findById(java.util.UUID.fromString(id)).isEmpty());
    }
}
