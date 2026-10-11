package br.dev.noiteboa.auth;

import br.dev.noiteboa.auth.dto.RegisterRequest;
import br.dev.noiteboa.auth.dto.RegisterResponse;
import br.dev.noiteboa.common.ratelimit.RateLimitExceededException;
import br.dev.noiteboa.common.ratelimit.RateLimiter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Locale;

@RestController
public class AuthController {

    private final AuthService authService;
    private final RateLimiter rateLimiter;
    private final int limiteLogin;
    private final long janelaLoginSegundos;
    private final int limiteCadastro;
    private final long janelaCadastroSegundos;

    public AuthController(AuthService authService, RateLimiter rateLimiter,
                          @Value("${noiteboa.ratelimit.login.limite}") int limiteLogin,
                          @Value("${noiteboa.ratelimit.login.janela-segundos}") long janelaLoginSegundos,
                          @Value("${noiteboa.ratelimit.cadastro.limite}") int limiteCadastro,
                          @Value("${noiteboa.ratelimit.cadastro.janela-segundos}") long janelaCadastroSegundos) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.limiteLogin = limiteLogin;
        this.janelaLoginSegundos = janelaLoginSegundos;
        this.limiteCadastro = limiteCadastro;
        this.janelaCadastroSegundos = janelaCadastroSegundos;
    }

    @PostMapping("/api/auth/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request,
                                                     HttpServletRequest http) {
        // por IP: criar conta em massa sai caro (issue #104)
        limitar("cadastro:" + ipDe(http), limiteCadastro, janelaCadastroSegundos);
        RegisterResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<br.dev.noiteboa.auth.dto.LoginResponse> login(
            @Valid @RequestBody br.dev.noiteboa.auth.dto.LoginRequest request, HttpServletRequest http) {
        // por IP + e-mail: adivinhar senha de uma conta específica sai caro,
        // mas IPs diferentes (rede corporativa, celular) não se atrapalham
        String chave = "login:" + ipDe(http) + ":" + chaveEmail(request.getEmail());
        limitar(chave, limiteLogin, janelaLoginSegundos);
        br.dev.noiteboa.auth.dto.LoginResponse response = authService.login(request);
        rateLimiter.limpar(chave); // login certo não conta contra o usuário
        return ResponseEntity.ok(response);
    }

    private void limitar(String chave, int limite, long janelaSegundos) {
        rateLimiter.tentar(chave, limite, Duration.ofSeconds(janelaSegundos)).ifPresent(espera -> {
            long segundos = Math.max(1, (long) Math.ceil(espera.toMillis() / 1000.0));
            throw new RateLimitExceededException(segundos,
                "Muitas tentativas. Tente novamente em " + segundos + (segundos == 1 ? " segundo." : " segundos."));
        });
    }

    private static String chaveEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * IP real do cliente com server.forward-headers-strategy=framework (configurado
     * no application.yml): atrás do proxy da Render, getRemoteAddr devolve o IP do
     * proxy e o cliente real vem em X-Forwarded-For. Localmente não há proxy e o
     * endereço direto já é o do cliente.
     */
    private static String ipDe(HttpServletRequest http) {
        return http.getRemoteAddr();
    }
}
