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

@SpringBootTest
@AutoConfigureMockMvc
class AuthLoginTest extends TesteComBanco {

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

    private void register(String email, String password) throws Exception {
        String body = "{\"displayName\":\"Lincoln\",\"email\":\"" + email + "\",\"password\":\"" + password + "\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
    }

    @Test
    void validLoginReturnsToken() throws Exception {
        register("login@example.com", "segredo123");
        String body = "{\"email\":\"login@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists())
            .andExpect(jsonPath("$.expiresInSeconds").exists());
    }

    @Test
    void passwordWith72BytesLogsIn() throws Exception {
        String senha = "a".repeat(72);
        register("limite72-login@example.com", senha);
        String body = "{\"email\":\"limite72-login@example.com\",\"password\":\"" + senha + "\"}";
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").exists());
    }

    @Test
    void passwordOver72BytesIsRejectedInsteadOfTruncated() throws Exception {
        // O BCrypt só considera os primeiros 72 bytes. Sem validar o tamanho no
        // login, a senha de 73 bytes abaixo (72 "a" + 1) autenticaria na conta
        // cuja senha é 72 "a", porque o byte extra seria ignorado.
        String senha = "a".repeat(72);
        register("truncamento@example.com", senha);
        String body = "{\"email\":\"truncamento@example.com\",\"password\":\"" + senha + "a\"}";
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void wrongPasswordReturns401Generic() throws Exception {
        register("login2@example.com", "segredo123");
        String body = "{\"email\":\"login2@example.com\",\"password\":\"errada\"}";
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void unknownEmailReturns401Generic() throws Exception {
        String body = "{\"email\":\"nada@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized());
    }
}
