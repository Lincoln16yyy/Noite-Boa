package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
class GoalEndpointTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;

    @AfterEach
    void cleanup() {
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

    @Test
    void defaultGoalIs8hAndIsFlaggedAsNotSaved() throws Exception {
        String token = token("g1@example.com");
        // GET /api/goal responde 200 com o default de 8h quando nunca houve
        // meta; `hasGoal=false` é o que permite o cliente distinguir esse
        // default de uma meta que o usuário escolheu (issue #215).
        mockMvc.perform(get("/api/goal").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetMinutes").value(480))
            .andExpect(jsonPath("$.hasGoal").value(false));
    }

    @Test
    void putValidatesAndPersists() throws Exception {
        String token = token("g2@example.com");
        String body = "{\"targetMinutes\":540,\"bedtime\":\"23:00:00\",\"wakeTime\":\"07:00:00\"}";
        mockMvc.perform(put("/api/goal").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetMinutes").value(540))
            .andExpect(jsonPath("$.hasGoal").value(true));
        mockMvc.perform(get("/api/goal").header("Authorization", "Bearer " + token))
            .andExpect(jsonPath("$.targetMinutes").value(540))
            .andExpect(jsonPath("$.hasGoal").value(true));
    }

    @Test
    void invalidTargetReturns400() throws Exception {
        String token = token("g3@example.com");
        String body = "{\"targetMinutes\":120}";
        mockMvc.perform(put("/api/goal").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }
}
