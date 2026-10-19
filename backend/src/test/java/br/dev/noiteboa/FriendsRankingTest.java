package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.dev.noiteboa.support.TesteComBanco;
import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.friends.Friendship;
import br.dev.noiteboa.friends.FriendshipRepository;
import br.dev.noiteboa.friends.FriendshipStatus;
import br.dev.noiteboa.sleep.SleepLog;
import br.dev.noiteboa.sleep.SleepLogRepository;
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
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Ranking de noites registradas (issue #39, nome da #142):
 * - só entram quem é amigo aceito E tem share_with_friends = true (regra de servidor);
 * - só expõe nº de noites e % dos dias — nunca horários, durações,
 *   qualidade ou observações;
 * - o próprio usuário aparece no ranking mesmo sem opt-in (é o ranking dele).
 */
@SpringBootTest
@AutoConfigureMockMvc
class FriendsRankingTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @Autowired
    FriendshipRepository friendshipRepository;

    @Autowired
    SleepLogRepository sleepLogRepository;

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

    private User seedUser(String email, String name, boolean share) {
        User u = new User(UUID.randomUUID(), email, "x", name, OffsetDateTime.now());
        u.setShareWithFriends(share);
        return userRepository.save(u);
    }

    private void seedFriendship(User a, User b, FriendshipStatus status) {
        Friendship f = new Friendship(UUID.randomUUID(), a, b);
        if (status == FriendshipStatus.ACCEPTED) {
            f.accept();
        }
        friendshipRepository.save(f);
    }

    /** Registra uma noite que "começa" k dias atrás, às 22h no fuso do usuário. */
    private void seedNight(User user, int daysAgo) {
        seedNightAt(user, daysAgo, 22);
    }

    /** Registra uma noite que começa hoje, à `hora` local (tem que ser no passado). */
    private void seedNightAt(User user, int daysAgo, int hora) {
        seedNightAt(user, daysAgo, hora, 8);
    }

    private void seedNightAt(User user, int daysAgo, int hora, int duracaoHoras) {
        ZoneId zone = ZoneId.of(user.getTimezone());
        OffsetDateTime start = OffsetDateTime.now(zone).withHour(hora).withMinute(0).withSecond(0).withNano(0)
            .minusDays(daysAgo);
        sleepLogRepository.save(new SleepLog(UUID.randomUUID(), user, start, start.plusHours(duracaoHoras), (short) 4, null));
    }

    /**
     * Fuso em que "agora" são `hora` horas (offset fixo válido). Fixar a hora
     * local deixa o teste independente do relógio: o corte de N×24h cai sempre
     * no mesmo horário do dia, longe dos horários usados nas noites semeadas.
     */
    private static ZoneId fusoComHoraLocal(int hora) {
        int deslocamento = Math.floorMod(hora - ZonedDateTime.now(ZoneOffset.UTC).getHour(), 24);
        if (deslocamento > 11) {
            deslocamento -= 24;
        }
        return ZoneOffset.ofTotalSeconds(deslocamento * 3600);
    }

    @Test
    void rankingShowsOnlyMeAndFriendsWhoShare() throws Exception {
        String anaToken = loginToken("ana-rank@example.com", "Ana");
        User ana = userRepository.findByEmailIgnoreCase("ana-rank@example.com").orElseThrow();
        User bruno = seedUser("bruno-rank@example.com", "Bruno", true);   // amigo que compartilha
        User carla = seedUser("carla-rank@example.com", "Carla", false);  // amiga que NÃO compartilha
        User davi = seedUser("davi-rank@example.com", "Davi", true);      // compartilha mas NÃO é amigo aceito
        User elena = seedUser("elena-rank@example.com", "Elena", true);   // compartilha, mas o convite foi RECUSADO
        seedFriendship(ana, bruno, FriendshipStatus.ACCEPTED);
        seedFriendship(ana, carla, FriendshipStatus.ACCEPTED);
        seedFriendship(ana, davi, FriendshipStatus.PENDING);
        seedFriendship(ana, elena, FriendshipStatus.DECLINED);

        for (int k = 1; k <= 3; k++) seedNight(ana, k);      // 3 noites em 7 dias
        for (int k = 1; k <= 6; k++) seedNight(bruno, k);    // 6 noites em 7 dias
        for (int k = 1; k <= 7; k++) seedNight(carla, k);    // semana perfeita, mas sem opt-in
        for (int k = 1; k <= 7; k++) seedNight(davi, k);     // semana perfeita, mas só convite pendente
        for (int k = 1; k <= 7; k++) seedNight(elena, k);    // semana perfeita, mas convite recusado

        MvcResult res = mockMvc.perform(get("/api/friends/ranking?days=7")
                .header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.days").value(7))
            .andExpect(jsonPath("$.ranking.length()").value(2))
            .andExpect(jsonPath("$.ranking[0].displayName").value("Bruno"))
            .andExpect(jsonPath("$.ranking[0].isMe").value(false))
            .andExpect(jsonPath("$.ranking[0].consistencyPercent").value(86))  // 6/7
            .andExpect(jsonPath("$.ranking[0].nights").value(6))
            .andExpect(jsonPath("$.ranking[1].displayName").value("Ana"))
            .andExpect(jsonPath("$.ranking[1].isMe").value(true))
            .andExpect(jsonPath("$.ranking[1].consistencyPercent").value(43))  // 3/7
            .andExpect(jsonPath("$.ranking[1].nights").value(3))
            .andReturn();

        // privacidade: sem opt-in ou sem amizade aceita = ausente do ranking,
        // mesmo com semana perfeita de registro (vale para pending e declined)
        String body = res.getResponse().getContentAsString().toLowerCase();
        org.junit.jupiter.api.Assertions.assertFalse(body.contains("carla"), "Carla não compartilha e apareceu");
        org.junit.jupiter.api.Assertions.assertFalse(body.contains("davi"), "Davi não é amigo aceito e apareceu");
        org.junit.jupiter.api.Assertions.assertFalse(body.contains("elena"), "Elena teve convite recusado e apareceu");
        // e-mails nunca circulam no ranking — só nome de exibição
        org.junit.jupiter.api.Assertions.assertFalse(body.contains("ana-rank@example.com"), "e-mail de Ana vazou");
        org.junit.jupiter.api.Assertions.assertFalse(body.contains("bruno-rank@example.com"), "e-mail de Bruno vazou");
    }

    /**
     * Issue #275: a janela é contada em dias locais, não em N×24h. Uma janela de
     * N×24h cobre um pedaço do dia N e outro do dia 0, então cabiam N+1 datas
     * locais (8 noites em 7 dias = 114% "dos dias"). O fuso é escolhido para que
     * "agora" sejam 15h locais: assim a noite de 7 dias atrás, às 22h, cai
     * depois do corte de 7×24h e é a 8ª data — sem inventar noite no futuro.
     */
    @Test
    void consistencyNeverPasses100WithLogsOnBothEdgesOfTheWindow() throws Exception {
        String anaToken = loginToken("ana-borda@example.com", "Ana");
        User ana = userRepository.findByEmailIgnoreCase("ana-borda@example.com").orElseThrow();
        ana.updateTimezone(fusoComHoraLocal(15).getId());
        userRepository.save(ana);

        for (int k = 1; k <= 7; k++) {
            seedNight(ana, k); // 22h de today-7 até today-1 (a última termina às 6h de hoje)
        }
        seedNightAt(ana, 0, 7, 1); // 7h-8h de hoje: a 8ª data local, já no passado

        mockMvc.perform(get("/api/friends/ranking?days=7").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ranking.length()").value(1))
            .andExpect(jsonPath("$.ranking[0].isMe").value(true))
            .andExpect(jsonPath("$.ranking[0].consistencyPercent").value(100))
            .andExpect(jsonPath("$.ranking[0].nights").value(7));
    }

    @Test
    void rankingNeverExposesRawSleepData() throws Exception {
        String anaToken = loginToken("ana-raw@example.com", "Ana");
        User ana = userRepository.findByEmailIgnoreCase("ana-raw@example.com").orElseThrow();
        User bruno = seedUser("bruno-raw@example.com", "Bruno", true);
        seedFriendship(ana, bruno, FriendshipStatus.ACCEPTED);
        for (int k = 1; k <= 3; k++) seedNight(ana, k);
        seedNight(bruno, 1);

        String body = mockMvc.perform(get("/api/friends/ranking?days=7")
                .header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString().toLowerCase();

        for (String proibido : new String[] {"sleepstart", "sleepend", "quality", "notes", "bedtime", "waketime"}) {
            org.junit.jupiter.api.Assertions.assertFalse(body.contains(proibido),
                "ranking expôs dado bruto de sono: " + proibido);
        }
    }

    @Test
    void shareToggleHidesAndShowsFriendImmediately() throws Exception {
        String anaToken = loginToken("ana-toggle@example.com", "Ana");
        User ana = userRepository.findByEmailIgnoreCase("ana-toggle@example.com").orElseThrow();
        User bruno = seedUser("bruno-toggle@example.com", "Bruno", false); // opt-in desligado
        seedFriendship(ana, bruno, FriendshipStatus.ACCEPTED);
        seedNight(bruno, 1);

        // opt-in desligado: invisível no ranking, mesmo sendo amigo
        mockMvc.perform(get("/api/friends/ranking?days=7").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ranking.length()").value(1));

        bruno.setShareWithFriends(true);
        userRepository.save(bruno);
        mockMvc.perform(get("/api/friends/ranking?days=7").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ranking.length()").value(2));

        bruno.setShareWithFriends(false);
        userRepository.save(bruno);
        mockMvc.perform(get("/api/friends/ranking?days=7").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ranking.length()").value(1));
    }

    @Test
    void ownRowAppearsEvenWithoutOptInAndDaysIsValidated() throws Exception {
        String anaToken = loginToken("ana-ownrow@example.com", "Ana");
        seedNight(userRepository.findByEmailIgnoreCase("ana-ownrow@example.com").orElseThrow(), 1);

        // sem opt-in, o usuário ainda vê a si mesmo no próprio ranking
        mockMvc.perform(get("/api/friends/ranking?days=7").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ranking.length()").value(1))
            .andExpect(jsonPath("$.ranking[0].isMe").value(true));

        // só 7 ou 30 dias
        mockMvc.perform(get("/api/friends/ranking?days=15").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isBadRequest());
        mockMvc.perform(get("/api/friends/ranking?days=0").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isBadRequest());

        // padrão: 7 dias
        mockMvc.perform(get("/api/friends/ranking").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.days").value(7));
    }

    @Test
    void friendListRevealsOnlyShareFlagNeverMetrics() throws Exception {
        String anaToken = loginToken("ana-flag@example.com", "Ana");
        User ana = userRepository.findByEmailIgnoreCase("ana-flag@example.com").orElseThrow();
        User bruno = seedUser("bruno-flag@example.com", "Bruno", false);
        seedFriendship(ana, bruno, FriendshipStatus.ACCEPTED);
        for (int k = 1; k <= 5; k++) seedNight(bruno, k);

        String body = mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + anaToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].displayName").value("Bruno"))
            .andExpect(jsonPath("$[0].sharesData").value(false))
            .andReturn().getResponse().getContentAsString().toLowerCase();

        // a lista de amigos só diz "compartilha ou não" — sem métrica alguma
        for (String proibido : new String[] {"consistency", "nights", "sleepstart", "quality"}) {
            org.junit.jupiter.api.Assertions.assertFalse(body.contains(proibido),
                "lista de amigos expôs métrica/dado de sono: " + proibido);
        }
    }
}
