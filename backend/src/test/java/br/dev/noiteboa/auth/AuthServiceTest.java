package br.dev.noiteboa.auth;

import br.dev.noiteboa.auth.dto.LoginRequest;
import br.dev.noiteboa.auth.jwt.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * #279: em vez de exigir um piso de tempo no login (flaky em runner lento),
 * prova o comportamento que torna e-mail inexistente e senha errada
 * indistinguíveis (#103): o BCrypt roda contra o hash falso mesmo sem conta.
 */
class AuthServiceTest {

    @Test
    void emailInexistenteComparaContraOHashFalso() {
        UserRepository users = mock(UserRepository.class);
        BCryptPasswordEncoder encoder = mock(BCryptPasswordEncoder.class);
        JwtService jwt = mock(JwtService.class);
        when(encoder.encode(anyString())).thenReturn("hash-falso");
        when(encoder.matches(anyString(), anyString())).thenReturn(false);
        when(users.findByEmailIgnoreCase("sumido@example.com")).thenReturn(Optional.empty());

        AuthService service = new AuthService(users, encoder, jwt);
        LoginRequest pedido = new LoginRequest();
        pedido.setEmail("sumido@example.com");
        pedido.setPassword("qualquer");

        assertThatThrownBy(() -> service.login(pedido))
            .isInstanceOfSatisfying(ResponseStatusException.class,
                e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));

        // Sem esse `matches`, a rota cairia para ~1ms e denunciaria o e-mail.
        verify(encoder).matches("qualquer", "hash-falso");
    }
}
