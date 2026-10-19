package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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

@SpringBootTest
@AutoConfigureMockMvc
class MeEndpointTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @AfterEach
    void cleanup() {
        userRepository.findAll().stream()
            .filter(u -> u.getEmail().endsWith("@example.com"))
            .forEach(userRepository::delete);
    }

    private String loginToken(String email) throws Exception {
        String register = "{\"displayName\":\"Lincoln\",\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(register));
        String login = "{\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        MvcResult res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(login))
            .andExpect(status().isOk())
            .andReturn();
        String json = res.getResponse().getContentAsString();
        return com.fasterxml.jackson.databind.json.JsonMapper.builder().build()
            .readTree(json).get("accessToken").asText();
    }

    @Test
    void noTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void validTokenReturnsUser() throws Exception {
        String token = loginToken("me@example.com");
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.email").value("me@example.com"))
            .andExpect(jsonPath("$.displayName").value("Lincoln"))
            .andExpect(jsonPath("$.timezone").value("America/Sao_Paulo"));
    }

    @Test
    void tamperedTokenReturns401() throws Exception {
        String token = loginToken("me2@example.com");
        String tampered = token.substring(0, token.length() - 2) + "xx";
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + tampered))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void updateTimezonePersists() throws Exception {
        String token = loginToken("me3@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"timezone\":\"Europe/Lisbon\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.timezone").value("Europe/Lisbon"));
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.timezone").value("Europe/Lisbon"));
    }

    @Test
    void invalidTimezoneReturns400() throws Exception {
        String token = loginToken("me4@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"timezone\":\"Marte/Cratera\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void blankTimezoneReturns400() throws Exception {
        String token = loginToken("me5@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"timezone\":\"\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void shareWithFriendsStartsDisabled() throws Exception {
        String token = loginToken("share1@example.com");
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareWithFriends").value(false));
    }

    @Test
    void shareWithFriendsTogglesAndPersists() throws Exception {
        String token = loginToken("share2@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"shareWithFriends\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareWithFriends").value(true));
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareWithFriends").value(true));
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"shareWithFriends\":false}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shareWithFriends").value(false));
    }

    @Test
    void emptyUpdateReturns400() throws Exception {
        String token = loginToken("share3@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isBadRequest());
        // campos presentes mas nulos contam como "nenhum dos dois informado"
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"timezone\":null,\"shareWithFriends\":null}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void shareOnlyUpdatePreservesSavedTimezone() throws Exception {
        String token = loginToken("share7@example.com");
        // fuso diferente do padrão, para detectar sobrescrita acidental
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"timezone\":\"Europe/Lisbon\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.timezone").value("Europe/Lisbon"));

        // atualiza só o compartilhamento: o fuso salvo deve permanecer
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"shareWithFriends\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.timezone").value("Europe/Lisbon"))
            .andExpect(jsonPath("$.shareWithFriends").value(true));

        // e persiste no banco, não só na resposta
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.timezone").value("Europe/Lisbon"))
            .andExpect(jsonPath("$.shareWithFriends").value(true));
    }

    @Test
    void timezoneAndShareTogetherInOneCall() throws Exception {
        String token = loginToken("share4@example.com");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"timezone\":\"UTC\",\"shareWithFriends\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.timezone").value("UTC"))
            .andExpect(jsonPath("$.shareWithFriends").value(true));
    }
}
