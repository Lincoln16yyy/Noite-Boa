package br.dev.noiteboa;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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

/**
 * Fluxo de amizade por consentimento duplo (issue #39):
 * convite → aceite/recusa/cancelamento → lista → remoção.
 */
@SpringBootTest
@AutoConfigureMockMvc
class FriendsFlowTest {

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

    private void invite(String token, String email) throws Exception {
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
            .andExpect(status().isOk());
    }

    /** Busca o id de um convite pendente pelo e-mail do outro lado ("sent" ou "received"). */
    private String requestId(String token, String side, String friendEmail) throws Exception {
        MvcResult res = mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andReturn();
        for (var node : MAPPER.readTree(res.getResponse().getContentAsString()).get(side)) {
            if (node.get("friend").get("email").asText().equalsIgnoreCase(friendEmail)) {
                return node.get("id").asText();
            }
        }
        throw new AssertionError("convite não encontrado no lado " + side + " para " + friendEmail);
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/friends")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/friends/requests")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/friends/ranking")).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/friends/requests").contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"x@example.com\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void fullFlowInviteAcceptAndList() throws Exception {
        String ana = loginToken("ana-flow@example.com", "Ana");
        String bruno = loginToken("bruno-flow@example.com", "Bruno");

        invite(ana, "bruno-flow@example.com");

        // convite pendente NÃO é amizade: nada aparece na lista ainda
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + ana))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        // o convidado vê o pedido recebido e aceita (consentimento do segundo lado)
        String receivedId = requestId(bruno, "received", "ana-flow@example.com");
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/accept")
                .header("Authorization", "Bearer " + bruno))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.displayName").value("Ana"));

        // agora sim: os dois são amigos, e o opt-in nasce desligado
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + ana))
            .andExpect(jsonPath("$[0].displayName").value("Bruno"))
            .andExpect(jsonPath("$[0].sharesData").value(false));
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + bruno))
            .andExpect(jsonPath("$[0].displayName").value("Ana"));

        // os convites saem das duas listas após o aceite
        mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + ana))
            .andExpect(jsonPath("$.sent.length()").value(0));
        mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + bruno))
            .andExpect(jsonPath("$.received.length()").value(0));
    }

    @Test
    void cannotInviteSelfOrInvalidEmailAndUnknownEmailIsNeutral() throws Exception {
        String ana = loginToken("ana-self@example.com", "Ana");
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + ana)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ana-self@example.com\"}"))
            .andExpect(status().isBadRequest());
        // #103: e-mail sem conta responde igual a e-mail com conta (neutro, 200)
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + ana)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ninguem@example.net\"}"))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + ana)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"\"}"))
            .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + ana)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"nao-eh-email\"}"))
            .andExpect(status().isBadRequest());
    }

    @Test
    void duplicatePendingInviteStaysNeutralAndAlreadyFriendsIs409() throws Exception {
        String ana = loginToken("ana-dup@example.com", "Ana");
        String bruno = loginToken("bruno-dup@example.com", "Bruno");
        invite(ana, "bruno-dup@example.com");
        // #103: reenvio do convite pendente é idempotente e neutro — um 409 aqui
        // denunciaria que o e-mail tem conta (o inexistente responderia 200 de novo)
        invite(ana, "bruno-dup@example.com");
        // já amigo também é 409
        String receivedId = requestId(bruno, "received", "ana-dup@example.com");
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/accept")
                .header("Authorization", "Bearer " + bruno))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + ana)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"bruno-dup@example.com\"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void declineKeepsFriendshipOutAndAllowsResend() throws Exception {
        String ana = loginToken("ana-dec@example.com", "Ana");
        String bruno = loginToken("bruno-dec@example.com", "Bruno");
        invite(ana, "bruno-dec@example.com");

        String receivedId = requestId(bruno, "received", "ana-dec@example.com");
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/decline")
                .header("Authorization", "Bearer " + bruno))
            .andExpect(status().isNoContent());

        // recusado: não vira amizade
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + ana))
            .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + bruno))
            .andExpect(jsonPath("$.received.length()").value(0));

        // reconvite depois da recusa: volta para a fila de espera
        invite(ana, "bruno-dec@example.com");
        requestId(bruno, "received", "ana-dec@example.com");
    }

    @Test
    void cancelSentInviteAllowsNewInvite() throws Exception {
        String ana = loginToken("ana-can@example.com", "Ana");
        String bruno = loginToken("bruno-can@example.com", "Bruno");
        invite(ana, "bruno-can@example.com");

        String sentId = requestId(ana, "sent", "bruno-can@example.com");
        mockMvc.perform(delete("/api/friends/requests/" + sentId).header("Authorization", "Bearer " + ana))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + ana))
            .andExpect(jsonPath("$.sent.length()").value(0));

        // cancelou de vez: pode convidar novamente
        invite(ana, "bruno-can@example.com");
    }

    @Test
    void onlyAddresseeCanAcceptOrDecline() throws Exception {
        String ana = loginToken("ana-own@example.com", "Ana");
        String bruno = loginToken("bruno-own@example.com", "Bruno");
        String davi = loginToken("davi-own@example.com", "Davi");
        invite(ana, "bruno-own@example.com");

        String receivedId = requestId(bruno, "received", "ana-own@example.com");
        // nem o próprio convidado de outra pessoa...
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/accept")
                .header("Authorization", "Bearer " + davi))
            .andExpect(status().isNotFound());
        // ...nem quem convidou pode aceitar por si (consentimento é do outro lado)
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/accept")
                .header("Authorization", "Bearer " + ana))
            .andExpect(status().isNotFound());
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/decline")
                .header("Authorization", "Bearer " + ana))
            .andExpect(status().isNotFound());
    }

    @Test
    void mutualInviteAutoAccepts() throws Exception {
        String ana = loginToken("ana-mut@example.com", "Ana");
        String bruno = loginToken("bruno-mut@example.com", "Bruno");
        invite(ana, "bruno-mut@example.com");

        // o convite mútuo já representa consentimento dos dois lados
        mockMvc.perform(post("/api/friends/requests").header("Authorization", "Bearer " + bruno)
                .contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"ana-mut@example.com\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("accepted"));

        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + ana))
            .andExpect(jsonPath("$[0].displayName").value("Bruno"));
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + bruno))
            .andExpect(jsonPath("$[0].displayName").value("Ana"));
    }

    @Test
    void removeFriendDeletesFriendship() throws Exception {
        String ana = loginToken("ana-rem@example.com", "Ana");
        String bruno = loginToken("bruno-rem@example.com", "Bruno");
        invite(ana, "bruno-rem@example.com");
        String receivedId = requestId(bruno, "received", "ana-rem@example.com");
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/accept")
                .header("Authorization", "Bearer " + bruno))
            .andExpect(status().isOk());

        MvcResult list = mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + ana))
            .andExpect(status().isOk())
            .andReturn();
        String friendshipId = MAPPER.readTree(list.getResponse().getContentAsString()).get(0).get("id").asText();

        mockMvc.perform(delete("/api/friends/" + friendshipId).header("Authorization", "Bearer " + ana))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + ana))
            .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + bruno))
            .andExpect(jsonPath("$.length()").value(0));

        // remover de novo: 404 (sem vazar que existiu)
        mockMvc.perform(delete("/api/friends/" + friendshipId).header("Authorization", "Bearer " + ana))
            .andExpect(status().isNotFound());
    }

    @Test
    void deletingAccountCascadesFriendships() throws Exception {
        String ana = loginToken("ana-del@example.com", "Ana");
        String bruno = loginToken("bruno-del@example.com", "Bruno");
        invite(ana, "bruno-del@example.com");
        String receivedId = requestId(bruno, "received", "ana-del@example.com");
        mockMvc.perform(post("/api/friends/requests/" + receivedId + "/accept")
                .header("Authorization", "Bearer " + bruno))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + bruno))
            .andExpect(jsonPath("$.length()").value(1));

        // V4 declara ON DELETE CASCADE: apagar a conta não pode falhar por FK
        // nem deixar amizade órfã apontando para usuário inexistente
        mockMvc.perform(delete("/api/me").header("Authorization", "Bearer " + ana))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/friends").header("Authorization", "Bearer " + bruno))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        // e o convite pendente da pessoa excluída também some
        String ana2 = loginToken("ana-del2@example.com", "Ana2");
        String davi = loginToken("davi-del@example.com", "Davi");
        invite(ana2, "davi-del@example.com");
        mockMvc.perform(delete("/api/me").header("Authorization", "Bearer " + ana2))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/friends/requests").header("Authorization", "Bearer " + davi))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.received.length()").value(0));
    }
}
