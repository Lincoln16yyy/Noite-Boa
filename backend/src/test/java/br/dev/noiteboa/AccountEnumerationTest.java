package br.dev.noiteboa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.support.TesteComBanco;
import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Enumeração de contas (issue #103): para um app com dados de sono, dizer se um
 * e-mail tem conta é vazamento de privacidade.
 * - o convite deve responder corpo e status idênticos para e-mail existente e
 *   inexistente (inclusive no reenvio do convite pendente — senão o duplo
 *   clique denuncia a existência);
 * - o login não pode diferenciar e-mail inexistente de senha errada nem em
 *   mensagem nem em tempo: a comparação BCrypt roda nos dois casos. O "roda
 *   mesmo sem conta" é provado em `AuthServiceTest` (sem medir tempo,
 *   #279); aqui só a resposta é comparada.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AccountEnumerationTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    @AfterEach
    void cleanup() {
        userRepository.findAll().stream()
            .filter(u -> u.getEmail().endsWith("@example.com"))
            .forEach(userRepository::delete);
    }

    private String loginToken(String email, String name) throws Exception {
        String register = "{\"displayName\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(register));
        String login = "{\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        MvcResult res = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(login))
            .andExpect(status().isOk())
            .andReturn();
        return MAPPER.readTree(res.getResponse().getContentAsString()).get("accessToken").asText();
    }

    private User seedUser(String email, String name) {
        User u = new User(UUID.randomUUID(), email, "x", name, OffsetDateTime.now());
        return userRepository.save(u);
    }

    private MvcResult invite(String token, String email) throws Exception {
        return mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
            .andExpect(status().isOk())
            .andReturn();
    }

    @Test
    void convite_responde_identico_para_email_existente_e_inexistente() throws Exception {
        String token = loginToken("ana-enum@example.com", "Ana");
        seedUser("existe-enum@example.com", "NomeVazador");

        String existente = invite(token, "existe-enum@example.com").getResponse().getContentAsString();
        String inexistente = invite(token, "nao-existe-enum@example.com").getResponse().getContentAsString();

        assertThat(inexistente).isEqualTo(existente);
        // corpo neutro: nem o nome de quem tem conta vaza
        assertThat(existente).doesNotContain("NomeVazador");
    }

    @Test
    void reenvio_do_convite_pendente_tambem_responde_neutro() throws Exception {
        String token = loginToken("bruno-enum@example.com", "Bruno");
        seedUser("outro-enum@example.com", "Outro");

        String primeiro = invite(token, "outro-enum@example.com").getResponse().getContentAsString();
        String segundo = invite(token, "outro-enum@example.com").getResponse().getContentAsString();

        assertThat(segundo).isEqualTo(primeiro);
    }

    @Test
    void login_nao_difere_email_inexistente_de_senha_errada() throws Exception {
        mockMvc.perform(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON)
                .content("{\"displayName\":\"Carol\",\"email\":\"carol-enum@example.com\",\"password\":\"segredo123\"}"))
            .andExpect(status().isCreated());

        MvcResult senhaErrada = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"carol-enum@example.com\",\"password\":\"errada\"}"))
            .andExpect(status().isUnauthorized())
            .andReturn();
        MvcResult semConta = mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"sumido-qualquer@example.com\",\"password\":\"qualquer\"}"))
            .andExpect(status().isUnauthorized())
            .andReturn();

        // mesma mensagem nos dois casos
        assertThat(semConta.getResponse().getContentAsString())
            .isEqualTo(senhaErrada.getResponse().getContentAsString());
    }
}
