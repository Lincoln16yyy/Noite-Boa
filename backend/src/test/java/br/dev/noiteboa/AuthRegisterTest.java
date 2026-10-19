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
class AuthRegisterTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @AfterEach
    void cleanup() {
        userRepository.findAll().stream()
            .filter(u -> u.getEmail().endsWith("@example.com"))
            .forEach(u -> userRepository.delete(u));
    }

    @Test
    void validRegisterReturns201AndNoPassword() throws Exception {
        String body = "{\"displayName\":\"Lincoln\",\"email\":\"teste@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.id").exists())
            .andExpect(jsonPath("$.email").value("teste@example.com"))
            .andExpect(jsonPath("$.password").doesNotExist())
            .andExpect(jsonPath("$.passwordHash").doesNotExist());
    }

    @Test
    void duplicateEmailReturns409() throws Exception {
        String body = "{\"displayName\":\"Lincoln\",\"email\":\"dup@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
        String dup = "{\"displayName\":\"Outro\",\"email\":\"DUP@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(dup))
            .andExpect(status().isConflict());
    }

    @Test
    void shortPasswordReturns400() throws Exception {
        String body = "{\"displayName\":\"Lincoln\",\"email\":\"curto@example.com\",\"password\":\"123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void invalidEmailReturns400() throws Exception {
        String body = "{\"displayName\":\"Lincoln\",\"email\":\"nao-e-email\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void emptyNameReturns400() throws Exception {
        String body = "{\"displayName\":\"\",\"email\":\"semnome@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void storedPasswordIsBCryptNotPlaintext() throws Exception {
        String body = "{\"displayName\":\"Lincoln\",\"email\":\"hash@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());
        var user = userRepository.findAll().stream()
            .filter(u -> u.getEmail().equals("hash@example.com")).findFirst().orElseThrow();
        org.junit.jupiter.api.Assertions.assertTrue(user.getPasswordHash().startsWith("$2"));
        org.junit.jupiter.api.Assertions.assertNotEquals("segredo123", user.getPasswordHash());
    }
}
