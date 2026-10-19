package br.dev.noiteboa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.support.TesteComBanco;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.common.GlobalExceptionHandler;
import br.dev.noiteboa.friends.Friendship;
import br.dev.noiteboa.friends.FriendshipRepository;
import br.dev.noiteboa.goal.SleepGoal;
import br.dev.noiteboa.goal.SleepGoalRepository;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.fasterxml.jackson.databind.json.JsonMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Corrida de unicidade (issue #106): o duplo clique em "Enviar convite" e dois
 * PUT /goal simultâneos passam pela checagem do serviço antes da gravação do
 * outro e violam UNIQUE (requester_id, addressee_id) / PK (user_id) no banco.
 * Isso NÃO pode cair no handler genérico e virar 500 — vira 409 com
 * ProblemDetail, e a constraint aparece num WARN para diagnóstico.
 *
 * A segunda gravação é simulada no repositório (spy do real que recusa como o
 * banco faria), que é o estado resultante da corrida.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CorridaUnicidade409Test extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @MockitoSpyBean
    FriendshipRepository friendshipRepository;

    @MockitoSpyBean
    SleepGoalRepository sleepGoalRepository;

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private Logger logger;
    private ListAppender<ILoggingEvent> captured;

    @BeforeEach
    void attachAppender() {
        logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        captured = new ListAppender<>();
        captured.start();
        logger.addAppender(captured);
    }

    @AfterEach
    void detachAndCleanup() {
        logger.detachAppender(captured);
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

    private br.dev.noiteboa.auth.User seedUser(String email, String name) {
        br.dev.noiteboa.auth.User u =
            new br.dev.noiteboa.auth.User(UUID.randomUUID(), email, "x", name, OffsetDateTime.now());
        return userRepository.save(u);
    }

    @Test
    void segundo_convite_em_corrida_vira_409_com_log_e_nao_500() throws Exception {
        String token = loginToken("ana-corrida@example.com", "Ana");
        seedUser("amigo-corrida@example.com", "Amigo");

        // estado de corrida: a outra requisição gravou o par DEPOIS da checagem do
        // serviço; a segunda gravação cai na UNIQUE e o banco recusa.
        doThrow(new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"uq_friendship_pair\""))
            .when(friendshipRepository).save(any(Friendship.class));

        mockMvc.perform(post("/api/friends/requests")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"amigo-corrida@example.com\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").isNotEmpty());

        // não engolir sem log: a constraint aparece num WARN para diagnóstico
        assertThat(captured.list).hasSize(1);
        assertThat(captured.list.get(0).getLevel()).isEqualTo(Level.WARN);
        assertThat(captured.list.get(0).getFormattedMessage()).contains("uq_friendship_pair");
    }

    @Test
    void goal_simultaneo_vira_409_com_log_e_nao_500() throws Exception {
        String token = loginToken("bia-corrida@example.com", "Bia");

        // mesma corrida no upsert do objetivo: dois PUTs com o mesmo user_id
        // ainda não gravado; o segundo INSERT viola a PK.
        doThrow(new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"sleep_goals_pkey\""))
            .when(sleepGoalRepository).save(any(SleepGoal.class));

        mockMvc.perform(put("/api/goal")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"targetMinutes\":480}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.detail").isNotEmpty());

        assertThat(captured.list).hasSize(1);
        assertThat(captured.list.get(0).getLevel()).isEqualTo(Level.WARN);
        assertThat(captured.list.get(0).getFormattedMessage()).contains("sleep_goals_pkey");
    }
}
