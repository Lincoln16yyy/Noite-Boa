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
    private final int limiteLoginEmail;
    private final long janelaLoginEmailSegundos;
    private final int limiteCadastro;
    private final long janelaCadastroSegundos;

    public AuthController(AuthService authService, RateLimiter rateLimiter,
                          @Value("${noiteboa.ratelimit.login.limite}") int limiteLogin,
                          @Value("${noiteboa.ratelimit.login.janela-segundos}") long janelaLoginSegundos,
                          @Value("${noiteboa.ratelimit.login-email.limite}") int limiteLoginEmail,
                          @Value("${noiteboa.ratelimit.login-email.janela-segundos}") long janelaLoginEmailSegundos,
                          @Value("${noiteboa.ratelimit.cadastro.limite}") int limiteCadastro,
                          @Value("${noiteboa.ratelimit.cadastro.janela-segundos}") long janelaCadastroSegundos) {
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.limiteLogin = limiteLogin;
        this.janelaLoginSegundos = janelaLoginSegundos;
        this.limiteLoginEmail = limiteLoginEmail;
        this.janelaLoginEmailSegundos = janelaLoginEmailSegundos;
        this.limiteCadastro = limiteCadastro;
        this.janelaCadastroSegundos = janelaCadastroSegundos;
    }

    @PostMapping("/api/auth/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request,
                                                     HttpServletRequest http) {
        // por IP: criar conta em massa sai caro (issue #104)
        limitar("cadastro:" + ipConfiavel(http), limiteCadastro, janelaCadastroSegundos);
        RegisterResponse response = authService.register(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<br.dev.noiteboa.auth.dto.LoginResponse> login(
            @Valid @RequestBody br.dev.noiteboa.auth.dto.LoginRequest request, HttpServletRequest http) {
        // por IP + e-mail: adivinhar senha de uma conta específica sai caro,
        // mas IPs diferentes (rede corporativa, celular) não se atrapalham
        String chaveIpEmail = "login:" + ipConfiavel(http) + ":" + chaveEmail(request.getEmail());
        // por e-mail, independente do IP: fecha o buraco de forjar o cabeçalho
        // de IP e trocar de IP a cada tentativa (issue #155). Sem revelar se a
        // conta existe: vale igual para e-mail com ou sem conta.
        String chaveEmail = "login-email:" + chaveEmail(request.getEmail());
        limitar(chaveIpEmail, limiteLogin, janelaLoginSegundos);
        limitar(chaveEmail, limiteLoginEmail, janelaLoginEmailSegundos);
        br.dev.noiteboa.auth.dto.LoginResponse response = authService.login(request);
        rateLimiter.limpar(chaveIpEmail); // login certo não conta contra o usuário
        rateLimiter.limpar(chaveEmail);
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
     * IP do cliente para o limite de tentativas (issue #155).
     *
     * A Render NÃO limpa o `X-Forwarded-For` que o cliente manda: ela apenas
     * acrescenta o próprio hop. Como o `ForwardedHeaderFilter` do Spring
     * (`server.forward-headers-strategy=framework`) reescreve `getRemoteAddr()`
     * com o PRIMEIRO valor do cabeçalho, esse valor é controlável pelo cliente.
     * Por isso preferimos o `CF-Connecting-IP`, que a Cloudflare (na frente da
     * Render) sobrescreve e o cliente não consegue forjar. Sem ele (ex.: acesso
     * direto/onrender sem Cloudflare, ou localmente) caímos no `getRemoteAddr()`.
     *
     * O teto por e-mail (independente do IP) é a defesa que não depende disso.
     */
    private static String ipConfiavel(HttpServletRequest http) {
        String cf = http.getHeader("CF-Connecting-IP");
        if (cf != null && !cf.isBlank()) {
            return cf.trim();
        }
        String trueClient = http.getHeader("True-Client-IP");
        if (trueClient != null && !trueClient.isBlank()) {
            return trueClient.trim();
        }
        return http.getRemoteAddr();
    }
}
