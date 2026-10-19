package br.dev.noiteboa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.support.TesteComBanco;
import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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
class JwtRecadastroMesmoEmailTest extends TesteComBanco {

    /**
     * IP só deste teste: o limite de cadastro é 5 por hora POR IP e a suíte
     * inteira compartilha o IP padrão do MockMvc. Usar um IP próprio evita
     * depender (e estourar) o contador das outras classes.
     */
    private static final String MEU_IP = "203.0.113.21";

    private static final String SENHA = "senha-de-teste-123";

    /** Cabeçalho que faz o interceptor de teste simular a troca de conta no meio da requisição. */
    private static final String CORRIDA_HEADER = "X-Teste-Corrida-Email";

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

    /**
     * Corrida (CWE-367) apontada pelos reviews do PR #282: o filtro autentica a
     * conta A; entre o filtro e o controller, A é excluída e o mesmo e-mail é
     * recadastrado na conta B. Se o principal (e a resolução no controller) fosse
     * o e-mail, o token antigo serviria os dados de B. Com o principal sendo o
     * id, a conta resolvida é a que o filtro verificou — A, que já não existe —
     * e a resposta é 401.
     *
     * O interceptor abaixo roda depois dos filtros (identidade já fixada) e antes
     * do controller: é literalmente o "meio da requisição".
     */
    @Test
    void corridaEntreFiltroEControllerNaoVazaParaContaRecriada() throws Exception {
        String email = "corrida-recadastro@example.com";
        registrar(email, "Conta antiga");
        String tokenAntigo = login(email);

        mockMvc.perform(get("/api/me")
                .header("Authorization", "Bearer " + tokenAntigo)
                .header(CORRIDA_HEADER, email))
            .andExpect(status().isUnauthorized());

        // A troca de conta aconteceu de verdade durante a requisição...
        var recriada = userRepository.findByEmailIgnoreCase(email);
        assertThat(recriada).isPresent();
        assertThat(recriada.get().getDisplayName()).isEqualTo("Conta nova (corrida)");
        // ...e mesmo assim o token antigo não devolveu os dados dela (401 acima).
    }

    private void registrar(String email, String displayName) throws Exception {
        mockMvc.perform(post("/api/auth/register")
                .header("CF-Connecting-IP", MEU_IP)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                    "displayName", displayName, "email", email, "password", SENHA))))
            .andExpect(status().isCreated());
        // Só entra no cleanup o que foi criado de verdade (review do PR #282):
        // adicionar antes deixaria o @AfterEach apagando conta de terceiro (mesmo
        // e-mail) se o cadastro falhasse.
        emailsCriados.add(email);
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

    /**
     * Só existe neste teste. Quando o cabeçalho está presente, troca a conta no
     * meio da requisição: exclui a que tem aquele e-mail e recadastra o mesmo
     * e-mail numa conta nova.
     */
    @TestConfiguration
    static class CorridaNoMeioDaRequisicaoConfig implements WebMvcConfigurer {

        @Autowired
        UserRepository userRepository;

        @Override
        public void addInterceptors(InterceptorRegistry registry) {
            registry.addInterceptor(new HandlerInterceptor() {
                @Override
                public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                    String email = request.getHeader(CORRIDA_HEADER);
                    if (email != null) {
                        userRepository.findByEmailIgnoreCase(email).ifPresent(userRepository::delete);
                        userRepository.save(new User(java.util.UUID.randomUUID(), email,
                            "hash-de-teste", "Conta nova (corrida)", java.time.OffsetDateTime.now()));
                    }
                    return true;
                }
            });
        }
    }
}
