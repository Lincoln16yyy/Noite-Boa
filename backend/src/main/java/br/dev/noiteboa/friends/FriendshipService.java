package br.dev.noiteboa.friends;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.sleep.SleepLogRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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
 * Amigos e ranking de consistência.
 *
 * Regras de privacidade (issue #39, desenho aprovado):
 * - amizade = consentimento duplo (convite + aceite);
 * - o ranking só inclui quem tem share_with_friends = true (filtro no servidor);
 * - o ranking expõe apenas consistência (%) e nº de noites — nunca horários,
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
    public List<FriendListItem> listFriends(String email) {
        User me = requireUser(email);
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
    public RequestsResponse listRequests(String email) {
        User me = requireUser(email);
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
    public SendResult sendRequest(String email, String inviteeEmail) {
        User me = requireUser(email);
        String normalized = inviteeEmail == null ? "" : inviteeEmail.trim().toLowerCase(Locale.ROOT);
        if (normalized.isEmpty() || normalized.equalsIgnoreCase(me.getEmail())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Você não pode convidar a si mesmo.");
        }
        User invitee = users.findByEmailIgnoreCase(normalized)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Não encontramos ninguém com este e-mail."));

        // convite inverso: um convite mútuo pendente equivale a aceite dos dois lados
        Optional<Friendship> incoming = friendships.findByRequesterIdAndAddresseeId(invitee.getId(), me.getId());
        if (incoming.isPresent()) {
            Friendship f = incoming.get();
            switch (f.getStatus()) {
                case ACCEPTED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Vocês já são amigos.");
                case PENDING -> {
                    f.accept();
                    friendships.save(f);
                    return new SendResult(f.getId(), f.getStatus().name().toLowerCase(Locale.ROOT), toFriend(invitee));
                }
                case BLOCKED -> throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Não encontramos ninguém com este e-mail.");
                case DECLINED -> { /* segue como novo convite */ }
            }
        }

        Optional<Friendship> outgoing = friendships.findByRequesterIdAndAddresseeId(me.getId(), invitee.getId());
        if (outgoing.isPresent()) {
            Friendship f = outgoing.get();
            switch (f.getStatus()) {
                case ACCEPTED -> throw new ResponseStatusException(HttpStatus.CONFLICT, "Vocês já são amigos.");
                case PENDING -> throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Convite já enviado. Aguarde a resposta.");
                case BLOCKED -> throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Não encontramos ninguém com este e-mail.");
                case DECLINED -> {
                    f.resend(); // recusou antes; pode mudar de ideia
                    friendships.save(f);
                    return new SendResult(f.getId(), "pending", toFriend(invitee));
                }
            }
        }

        Friendship friendship = new Friendship(UUID.randomUUID(), me, invitee);
        friendships.save(friendship);
        return new SendResult(friendship.getId(), "pending", toFriend(invitee));
    }

    @Transactional
    public FriendResponse accept(String email, UUID requestId) {
        Friendship f = loadForAddressee(email, requestId);
        f.accept();
        friendships.save(f);
        return toFriend(f.getRequester());
    }

    @Transactional
    public void decline(String email, UUID requestId) {
        Friendship f = loadForAddressee(email, requestId);
        f.decline(); // mantém o registro para evitar reconvite imediato em spam
        friendships.save(f);
    }

    @Transactional
    public void cancel(String email, UUID requestId) {
        User me = requireUser(email);
        Friendship f = friendships.findById(requestId)
            .filter(x -> x.getRequester().getId().equals(me.getId()))
            .filter(x -> x.getStatus() == FriendshipStatus.PENDING)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Convite não encontrado."));
        friendships.delete(f); // apaga de vez: permite convidar de novo depois
    }

    @Transactional
    public void removeFriend(String email, UUID friendshipId) {
        User me = requireUser(email);
        Friendship f = friendships.findById(friendshipId)
            .filter(x -> x.getStatus() == FriendshipStatus.ACCEPTED)
            .filter(x -> x.getRequester().getId().equals(me.getId()) || x.getAddressee().getId().equals(me.getId()))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Amizade não encontrada."));
        friendships.delete(f);
    }

    // ---------- ranking ----------

    @Transactional(readOnly = true)
    public RankingResponse ranking(String email, int days) {
        if (days != 7 && days != 30) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Informe 7 ou 30 dias.");
        }
        User me = requireUser(email);
        OffsetDateTime desde = OffsetDateTime.now().minusDays(days);

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

    private User requireUser(String email) {
        return users.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    }

    private Friendship loadForAddressee(String email, UUID requestId) {
        User me = requireUser(email);
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

    /** status: "pending" (convite criado) ou "accepted" (convite mútuo aceito automaticamente). */
    public record SendResult(UUID id, String status, FriendResponse friend) {}

    /** Só o que o ranking pode revelar: nada de horários, durações, qualidade ou notas. */
    public record RankingEntry(UUID userId, String displayName, boolean isMe, int consistencyPercent, int nights) {}

    public record RankingResponse(int days, List<RankingEntry> ranking) {}
}
