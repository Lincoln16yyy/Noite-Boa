package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Issue #276: o token precisa apontar para a CONTA, não para o e-mail.
 *
 * O `subject` era o e-mail e o filtro só conferia a assinatura. Como excluir a
 * conta libera o e-mail para um novo cadastro, o token emitido antes da exclusão
 * voltava a valer — e passava a dar acesso à conta nova, de outra pessoa.
 */
@SpringBootTest
@AutoConfigureMockMvc
class JwtRecadastroMesmoEmailTest {

    /**
     * IP só deste teste: o limite de cadastro é 5 por hora POR IP e a suíte
     * inteira compartilha o IP padrão do MockMvc. Usar um IP próprio evita
     * depender (e estourar) o contador das outras classes.
     */
    private static final String MEU_IP = "203.0.113.21";

    private static final String SENHA = "senha-de-teste-123";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @Autowired
    ObjectMapper objectMapper;

    private final List<String> emailsCriados = new ArrayList<>();

    @AfterEach
    void cleanup() {
        // Só os e-mails que este teste criou.
        emailsCriados.forEach(email ->
            userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete));
        emailsCriados.clear();
    }

    @Test
    void tokenAntigoNaoValeNaContaNovaComMesmoEmail() throws Exception {
        String email = "recadastro-token@example.com";

        registrar(email, "Conta antiga");
        String tokenAntigo = login(email);

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + tokenAntigo))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Conta antiga"));

        // Exclui a conta e recria com o MESMO e-mail: o índice único deixa,
        // porque a linha antiga foi apagada.
        mockMvc.perform(delete("/api/me").header("Authorization", "Bearer " + tokenAntigo))
            .andExpect(status().isNoContent());
        registrar(email, "Conta nova");

        // O token da conta excluída não pode dar acesso à conta nova.
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + tokenAntigo))
            .andExpect(status().isUnauthorized());

        // E o token da conta nova continua valendo (nada quebrou para quem está logado).
        String tokenNovo = login(email);
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + tokenNovo))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Conta nova"));
    }

    @Test
    void tokenDeixaDeValerAssimQueAContaEExcluida() throws Exception {
        String email = "excluida-token@example.com";
        registrar(email, "Vai sumir");
        String token = login(email);

        mockMvc.perform(delete("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
            .andExpect(status().isUnauthorized());
    }

    private void registrar(String email, String displayName) throws Exception {
        emailsCriados.add(email);
        mockMvc.perform(post("/api/auth/register")
                .header("CF-Connecting-IP", MEU_IP)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "displayName", displayName, "email", email, "password", SENHA))))
            .andExpect(status().isCreated());
    }

    private String login(String email) throws Exception {
        String json = mockMvc.perform(post("/api/auth/login")
                .header("CF-Connecting-IP", MEU_IP)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", SENHA))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(json).get("accessToken").asText();
    }
}
