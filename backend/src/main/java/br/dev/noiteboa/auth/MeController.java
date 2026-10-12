package br.dev.noiteboa.auth;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class MeController {

    private final UserRepository userRepository;

    public MeController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/api/me")
    public ResponseEntity<MeResponse> me(Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        var user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));
        return ResponseEntity.ok(new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getTimezone(), user.isShareWithFriends()));
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/api/me")
    public ResponseEntity<Void> delete(Authentication authentication) {
        String email = (String) authentication.getPrincipal();
        var user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));
        userRepository.delete(user);
        return ResponseEntity.noContent().build();
    }

    @org.springframework.web.bind.annotation.PutMapping("/api/me")
    public ResponseEntity<MeResponse> update(Authentication authentication,
            @jakarta.validation.Valid @org.springframework.web.bind.annotation.RequestBody br.dev.noiteboa.auth.dto.UpdateMeRequest request) {
        String email = (String) authentication.getPrincipal();
        var user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));
        if (request.getTimezone() == null && request.getShareWithFriends() == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.BAD_REQUEST, "Informe o fuso horário ou o compartilhamento.");
        }
        if (request.getTimezone() != null) {
            try {
                java.time.ZoneId.of(request.getTimezone());
            } catch (java.time.DateTimeException e) {
                throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "Fuso horário inválido");
            }
            user.updateTimezone(request.getTimezone());
        }
        if (request.getShareWithFriends() != null) {
            user.setShareWithFriends(request.getShareWithFriends());
        }
        userRepository.save(user);
        return ResponseEntity.ok(new MeResponse(user.getId(), user.getEmail(), user.getDisplayName(), user.getTimezone(), user.isShareWithFriends()));
    }

    record MeResponse(java.util.UUID id, String email, String displayName, String timezone, boolean shareWithFriends) {}
}
