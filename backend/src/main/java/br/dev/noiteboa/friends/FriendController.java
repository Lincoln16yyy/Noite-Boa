package br.dev.noiteboa.friends;

import br.dev.noiteboa.friends.dto.InviteRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Amigos e ranking de noites registradas. Todas as rotas exigem autenticação
 * (SecurityConfig: anyRequest().authenticated()).
 */
@RestController
@RequestMapping("/api/friends")
public class FriendController {

    private final FriendshipService service;

    public FriendController(FriendshipService service) {
        this.service = service;
    }

    @GetMapping
    public List<FriendshipService.FriendListItem> list(Authentication authentication) {
        return service.listFriends(usuario(authentication));
    }

    @DeleteMapping("/{friendshipId}")
    public ResponseEntity<Void> remove(Authentication authentication, @PathVariable UUID friendshipId) {
        service.removeFriend(usuario(authentication), friendshipId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/requests")
    public FriendshipService.RequestsResponse requests(Authentication authentication) {
        return service.listRequests(usuario(authentication));
    }

    @PostMapping("/requests")
    public ResponseEntity<FriendshipService.SendResult> invite(Authentication authentication,
            @Valid @RequestBody InviteRequest request) {
        return ResponseEntity.ok(service.sendRequest(usuario(authentication), request.email()));
    }

    @PostMapping("/requests/{id}/accept")
    public FriendshipService.FriendResponse accept(Authentication authentication, @PathVariable UUID id) {
        return service.accept(usuario(authentication), id);
    }

    @PostMapping("/requests/{id}/decline")
    public ResponseEntity<Void> decline(Authentication authentication, @PathVariable UUID id) {
        service.decline(usuario(authentication), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/requests/{id}")
    public ResponseEntity<Void> cancel(Authentication authentication, @PathVariable UUID id) {
        service.cancel(usuario(authentication), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/ranking")
    public FriendshipService.RankingResponse ranking(Authentication authentication,
            @RequestParam(defaultValue = "7") int days) {
        return service.ranking(usuario(authentication), days);
    }

    private static UUID usuario(Authentication authentication) {
        return (UUID) authentication.getPrincipal();
    }
}
