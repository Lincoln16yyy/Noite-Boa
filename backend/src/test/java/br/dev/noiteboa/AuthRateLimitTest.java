package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.auth.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.UUID;

/**
 * Limite de tentativas em login e cadastro (issue #104):
 * - login: 5 tentativas por minuto por IP + e-mail (padrão);
 * - cadastro: 5 por hora por IP (padrão);
 * - estouro responde 429 ProblemDetail com Retry-After;
 * - a janela reinicia sozinha; IPs diferentes não se atrapalham.
 *
 * A janela é encurtada para 2s aqui (o limite continua no padrão de produção,
 * 5) para testar o reinício sem esperar um minuto.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
    "noiteboa.ratelimit.login.limite=5",
    "noiteboa.ratelimit.login.janela-segundos=2",
    "noiteboa.ratelimit.cadastro.limite=5",
    "noiteboa.ratelimit.cadastro.janela-segundos=2",
})
class AuthRateLimitTest {

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

    private static MockHttpServletRequestBuilder deIp(MockHttpServletRequestBuilder builder, String ip) {
        return builder.with(request -> {
            request.setRemoteAddr(ip);
            return request;
        });
    }

    private void registrar(String ip, String email) throws Exception {
        String body = "{\"displayName\":\"Alvo\",\"email\":\"" + email + "\",\"password\":\"segredo123\"}";
        mockMvc.perform(deIp(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body), ip))
            .andExpect(status().isCreated());
    }

    private void loginErrado(String ip, String email) throws Exception {
        String body = "{\"email\":\"" + email + "\",\"password\":\"senha-errada\"}";
        mockMvc.perform(deIp(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body), ip))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void login_estoura_limite_com_429_e_retry_after() throws Exception {
        String email = "alvo-login-" + UUID.randomUUID() + "@example.com";
        registrar("10.1.0.1", email);

        for (int i = 0; i < 5; i++) {
            loginErrado("10.1.0.2", email); // dentro do limite: 401 normal
        }
        String body = "{\"email\":\"" + email + "\",\"password\":\"senha-errada\"}";
        mockMvc.perform(deIp(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body), "10.1.0.2"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.detail").isNotEmpty());
    }

    @Test
    void janela_do_login_reinicia_sozinha() throws Exception {
        String email = "alvo-janela-" + UUID.randomUUID() + "@example.com";
        registrar("10.2.0.1", email);

        for (int i = 0; i < 5; i++) {
            loginErrado("10.2.0.2", email);
        }
        String body = "{\"email\":\"" + email + "\",\"password\":\"senha-errada\"}";
        mockMvc.perform(deIp(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body), "10.2.0.2"))
            .andExpect(status().isTooManyRequests());

        Thread.sleep(2200); // janela de teste: 2s

        mockMvc.perform(deIp(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body), "10.2.0.2"))
            .andExpect(status().isUnauthorized()); // liberado de novo
    }

    @Test
    void login_de_um_ip_nao_bloqueia_outro_ip() throws Exception {
        String email = "alvo-ip-" + UUID.randomUUID() + "@example.com";
        registrar("10.3.0.1", email);

        for (int i = 0; i < 5; i++) {
            loginErrado("10.3.0.2", email);
        }
        String body = "{\"email\":\"" + email + "\",\"password\":\"senha-errada\"}";
        mockMvc.perform(deIp(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body), "10.3.0.2"))
            .andExpect(status().isTooManyRequests());

        // mesmo e-mail, outro IP: a chave do limite é IP + e-mail
        mockMvc.perform(deIp(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content(body), "10.3.0.9"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void cadastro_estoura_limite_por_ip_com_429() throws Exception {
        for (int i = 0; i < 5; i++) {
            registrar("10.4.0.1", "massa-" + i + "-" + UUID.randomUUID() + "@example.com");
        }
        String body = "{\"displayName\":\"Massa\",\"email\":\"massa-x-"
            + UUID.randomUUID() + "@example.com\",\"password\":\"segredo123\"}";
        mockMvc.perform(deIp(post("/api/auth/register").contentType(MediaType.APPLICATION_JSON).content(body), "10.4.0.1"))
            .andExpect(status().isTooManyRequests())
            .andExpect(header().exists("Retry-After"))
            .andExpect(jsonPath("$.detail").isNotEmpty());
    }

    @Test
    void cadastro_de_um_ip_nao_bloqueia_outro_ip() throws Exception {
        for (int i = 0; i < 5; i++) {
            registrar("10.5.0.1", "fazenda-" + i + "-" + UUID.randomUUID() + "@example.com");
        }
        // outro IP segue criando normalmente
        registrar("10.5.0.9", "outro-ip-" + UUID.randomUUID() + "@example.com");
    }
}
