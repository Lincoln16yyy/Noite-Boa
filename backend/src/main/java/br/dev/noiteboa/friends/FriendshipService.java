package br.dev.noiteboa.friends;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.sleep.SleepLogRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Amigos e ranking de noites registradas.
 *
 * Regras de privacidade (issue #39, desenho aprovado):
 * - amizade = consentimento duplo (convite + aceite);
 * - o envio de convite responde igual para e-mail existente e inexistente (#103);
 * - o ranking só inclui quem tem share_with_friends = true (filtro no servidor);
 * - o ranking expõe apenas nº de noites e % dos dias — nunca horários,
 *   durações, qualidade ou observações.
 */
@Service
public class FriendshipService {

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final SleepLogRepository sleepLogs;

    public FriendshipService(FriendshipRepository friendships, UserRepository users, SleepLogRepository sleepLogs) {
        this.friendships = friendships;
        this.users = users;
        this.sleepLogs = sleepLogs;
    }

    // ---------- amizade ----------

    @Transactional(readOnly = true)
    public List<FriendListItem> listFriends(UUID userId) {
        User me = requireUser(userId);
        return friendships.findFriendships(me.getId(), FriendshipStatus.ACCEPTED).stream()
            .map(f -> {
                User other = f.getRequester().getId().equals(me.getId()) ? f.getAddressee() : f.getRequester();
                // id = linha da amizade (para remover); sharesData = só o opt-in, nunca métrica
                return new FriendListItem(f.getId(), other.getDisplayName(), other.getEmail(), other.isShareWithFriends());
            })
            .sorted(Comparator.comparing(FriendListItem::displayName, String.CASE_INSENSITIVE_ORDER))
            .toList();
    }

    @Transactional(readOnly = true)
    public RequestsResponse listRequests(UUID userId) {
        User me = requireUser(userId);
        List<RequestResponse> sent = friendships.findByRequesterIdAndStatus(me.getId(), FriendshipStatus.PENDING).stream()
            .sorted(Comparator.comparing(Friendship::getCreatedAt).reversed())
            .map(f -> new RequestResponse(f.getId(), toFriend(f.getAddressee()), f.getCreatedAt()))
            .toList();
        List<RequestResponse> received = friendships.findByAddresseeIdAndStatus(me.getId(), FriendshipStatus.PENDING).stream()
            .sorted(Comparator.comparing(Friendship::getCreatedAt).reversed())
            .map(f -> new RequestResponse(f.getId(), toFriend(f.getRequester()), f.getCreatedAt()))
            .toList();
        return new RequestsResponse(sent, received);
    }

    @Transactional
    public SendResult sendRequest(UUID userId, String inviteeEmail) {
        User me = requireUser(userId);
        String normalized = inviteeEmail == null ? "" : inviteeEmail.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.equalsIgnoreCase(me.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Você não pode convidar a si mesmo.");
        }
        Optional<User> maybeInvitee = users.findByEmailIgnoreCase(normalized);
        if (maybeInvitee.isEmpty()) {
            // #103: sem conta, sem convite — mas a resposta é a mesma neutra de
            // conta existente, para não revelar quem tem conta no app.
            return SendResult.neutral();
        }
        User invitee = maybeInvitee.get();

        // convite inverso: um convite mútuo pendente equivale a aceite dos dois lados
        Optional<Friendship> incoming = friendships.findByRequesterIdAndAddresseeId(invitee.getId(), me.getId());
        if (incoming.isPresent()) {
            Friendship f = incoming.get();
            switch (f.getStatus()) {
                // relação já existente entre os dois: 409 não vaza nada de estranhos
                case ACCEPTED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Vocês já são amigos.");
                case PENDING -> {
                    f.accept();
                    friendships.save(f);
                    return new SendResult(f.getId(), "accepted", toFriend(invitee));
                }
                // bloqueio fica escondido: mesma resposta de conta inexistente
                case BLOCKED -> { return SendResult.neutral(); }
                case DECLINED -> { /* segue como novo convite */ }
            }
        }

        Optional<Friendship> outgoing = friendships.findByRequesterIdAndAddresseeId(me.getId(), invitee.getId());
        if (outgoing.isPresent()) {
            Friendship f = outgoing.get();
            switch (f.getStatus()) {
                case ACCEPTED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Vocês já são amigos.");
                // #103: pendente recusado não pode virar 409 — o duplo clique de um
                // e-mail inexistente responderia 200 e denunciaria a existência.
                // Idempotente: o convite pendente já está lá (visível em "Enviados").
                case PENDING -> { return SendResult.neutral(); }
                case BLOCKED -> { return SendResult.neutral(); }
                case DECLINED -> { f.resend(); friendships.save(f); return SendResult.neutral(); }
            }
        }

        friendships.save(new Friendship(UUID.randomUUID(), me, invitee));
        return SendResult.neutral();
    }

    @Transactional
    public FriendResponse accept(UUID userId, UUID requestId) {
        Friendship f = loadForAddressee(userId, requestId);
        f.accept();
        friendships.save(f);
        return toFriend(f.getRequester());
    }

    @Transactional
    public void decline(UUID userId, UUID requestId) {
        Friendship f = loadForAddressee(userId, requestId);
        f.decline(); // mantém o registro para evitar reconvite imediato em spam
        friendships.save(f);
    }

    @Transactional
    public void cancel(UUID userId, UUID requestId) {
        User me = requireUser(userId);
        Friendship f = friendships.findById(requestId)
            .filter(x -> x.getRequester().getId().equals(me.getId()))
            .filter(x -> x.getStatus() == FriendshipStatus.PENDING)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
        friendships.delete(f); // apaga de vez: permite convidar de novo depois
    }

    @Transactional
    public void removeFriend(UUID userId, UUID friendshipId) {
        User me = requireUser(userId);
        Friendship f = friendships.findById(friendshipId)
            .filter(x -> x.getStatus() == FriendshipStatus.ACCEPTED)
            .filter(x -> x.getRequester().getId().equals(me.getId()) || x.getAddressee().getId().equals(me.getId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Amizade não encontrada."));
        friendships.delete(f);
    }

    // ---------- ranking ----------

    @Transactional(readOnly = true)
    public RankingResponse ranking(UUID userId, int days) {
        if (days != 7 && days != 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe 7 ou 30 dias.");
        }
        User me = requireUser(userId);

        // regra de servidor: eu + amigos aceitos que optaram por compartilhar.
        // Quem tem share_with_friends = false não entra no cálculo (nem por UI).
        List<User> participantes = new ArrayList<>();
        participantes.add(me);
        friendships.findFriendships(me.getId(), FriendshipStatus.ACCEPTED).stream()
            .map(f -> f.getRequester().getId().equals(me.getId()) ? f.getAddressee() : f.getRequester())
            .filter(User::isShareWithFriends)
            .forEach(participantes::add);

        List<RankingEntry> ranking = participantes.stream()
            .map(u -> {
                ZoneId zone = ZoneId.of(u.getTimezone() != null ? u.getTimezone() : "America/Sao_Paulo");
                // #275: a janela são os últimos `days` dias locais, hoje incluso.
                // Uma janela de `days`×24h cobre pedaços de `days + 1` datas
                // locais (a noite que começou antes do corte + a de hoje), então
                // a contagem podia passar do total e o % passar de 100.
                OffsetDateTime desde = LocalDate.now(zone).minusDays(days - 1L).atStartOfDay(zone).toOffsetDateTime();
                // noite = dia local (do início do sono) com pelo menos um registro
                // (#98: o limite de data vai para a consulta, não varre o histórico)
                Set<java.time.LocalDate> diasComRegistro = sleepLogs
                    .findByUserIdAndSleepStartGreaterThanOrderBySleepStartDesc(u.getId(), desde).stream()
                    .map(l -> l.getSleepStart().atZoneSameInstant(zone).toLocalDate())
                    .collect(Collectors.toSet());
                int noites = diasComRegistro.size();
                int consistencia = (int) Math.round(100.0 * noites / days);
                return new RankingEntry(u.getId(), u.getDisplayName(), u.getId().equals(me.getId()), consistencia, noites);
            })
            .sorted(Comparator
                .comparingInt(RankingEntry::consistencyPercent).reversed()
                .thenComparing(Comparator.comparingInt(RankingEntry::nights).reversed())
                .thenComparing(RankingEntry::displayName, String.CASE_INSENSITIVE_ORDER))
            .toList();

        return new RankingResponse(days, ranking);
    }

    // ---------- apoio ----------

    private User requireUser(UUID userId) {
        return users.findById(userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private Friendship loadForAddressee(UUID userId, UUID requestId) {
        User me = requireUser(userId);
        return friendships.findById(requestId)
            .filter(x -> x.getAddressee().getId().equals(me.getId()))
            .filter(x -> x.getStatus() == FriendshipStatus.PENDING)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
    }

    /** sharesData expõe só a existência do opt-in; métricas viriam em outro payload, se permitido. */
    private static FriendResponse toFriend(User user) {
        return new FriendResponse(user.getId(), user.getDisplayName(), user.getEmail(), user.isShareWithFriends());
    }

    public record FriendResponse(UUID id, String displayName, String email, boolean sharesData) {}

    /** Item da lista de amigos: id é a linha da amizade (usada para remover). */
    public record FriendListItem(UUID id, String displayName, String email, boolean sharesData) {}

    public record RequestResponse(UUID id, FriendResponse friend, OffsetDateTime createdAt) {}

    public record RequestsResponse(List<RequestResponse> sent, List<RequestResponse> received) {}

    /** status: "sent" (resposta neutra: criado, já pendente ou e-mail sem conta — os
     *  três casos idênticos para não revelar quem tem conta, issue #103) ou
     *  "accepted" (convite mútuo aceito automaticamente). */
    public record SendResult(UUID id, String status, FriendResponse friend) {
        static SendResult neutral() {
            return new SendResult(null, "sent", null);
        }
    }

    /** Só o que o ranking pode revelar: nada de horários, durações, qualidade ou notas. */
    public record RankingEntry(UUID userId, String displayName, boolean isMe, int consistencyPercent, int nights) {}

    public record RankingResponse(int days, List<RankingEntry> ranking) {}
}
