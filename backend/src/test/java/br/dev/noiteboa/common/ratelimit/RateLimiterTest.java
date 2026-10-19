package br.dev.noiteboa.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

/**
 * Issue #268: a limpeza de chaves vencidas podava TODAS as chaves com a janela
 * da chamada atual. Um login (60 s) esvaziava as tentativas de `login-email`
 * (1 h) e enfraquecia o teto por e-mail justamente quando o mapa cresce
 * (cenário de ataque), abrindo espaço para brute force de uma conta.
 */
class RateLimiterTest {

    /** Relógio controlado pelo teste: nada aqui depende de sleep ou do relógio real. */
    private final RelogioFalso relogio = new RelogioFalso();

    /** Gatilho baixo e limpeza sem intervalo para o teste não criar 50 mil chaves. */
    private RateLimiter limiter(int maxChaves) {
        return new RateLimiter(10, Duration.ZERO, maxChaves, relogio);
    }

    @Test
    void limpezaNaoAfrouxaOTetoDeUmaChaveComJanelaLonga() {
        RateLimiter limiter = limiter(100_000);
        String email = "login-email:alvo@example.com";
        Duration janelaEmail = Duration.ofHours(1);
        int limiteEmail = 3;

        // Esgota o teto por e-mail (janela de 1 h).
        for (int i = 0; i < limiteEmail; i++) {
            assertThat(limiter.tentar(email, limiteEmail, janelaEmail)).isEmpty();
        }
        assertThat(limiter.tentar(email, limiteEmail, janelaEmail))
            .as("teto por e-mail atingido")
            .isPresent();

        // As tentativas acima precisam ser mais antigas que a janela curta da
        // limpeza, senão o caso do bug nem é exercitado.
        relogio.avancar(Duration.ofSeconds(30));

        // Enche o mapa acima do gatilho com chaves de janela curta (login por IP).
        Duration janelaCurta = Duration.ofMillis(1);
        for (int i = 0; i < 12; i++) {
            limiter.tentar("login:ip-" + i, 5, janelaCurta);
        }

        // A limpeza pode podar as chaves curtas, mas não as tentativas de 1 h:
        // a 4ª tentativa do e-mail continua bloqueada.
        assertThat(limiter.tentar(email, limiteEmail, janelaEmail))
            .as("o teto por e-mail por hora sobrevive à limpeza")
            .isPresent();
    }

    @Test
    void limpezaRemoveAsChavesDeJanelaCurtaVencidas() {
        RateLimiter limiter = limiter(100_000);
        String email = "login-email:alvo@example.com";
        limiter.tentar(email, 3, Duration.ofHours(1));

        for (int i = 0; i < 12; i++) {
            limiter.tentar("login:ip-" + i, 5, Duration.ofMillis(1));
        }
        relogio.avancar(Duration.ofMillis(20)); // as chaves curtas venceram

        // Qualquer chamada acima do gatilho dispara a limpeza (intervalo zero).
        for (int i = 0; i < 3; i++) {
            limiter.tentar("login:gatilho-" + i, 5, Duration.ofMillis(1));
        }

        // Se `limparVencidas` virasse um no-op, a chave curta continuaria no mapa
        // e este teste falharia — o teste do teto por e-mail sozinho não pega isso.
        assertThat(limiter.temChave("login:ip-0"))
            .as("chave curta vencida foi podada")
            .isFalse();
        assertThat(limiter.temChave(email))
            .as("chave de 1 h preservada")
            .isTrue();
    }

    @Test
    void limpezaNaoRodaDentroDoIntervalo() {
        // Intervalo de 1 h: a varredura não pode acontecer a cada requisição.
        RateLimiter limiter = new RateLimiter(10, Duration.ofHours(1), 100_000, relogio);
        for (int i = 0; i < 12; i++) {
            limiter.tentar("login:ip-" + i, 5, Duration.ofMillis(1));
        }
        relogio.avancar(Duration.ofMillis(20));
        limiter.tentar("login:gatilho", 5, Duration.ofMillis(1));

        assertThat(limiter.temChave("login:ip-0"))
            .as("sem varredura dentro do intervalo")
            .isTrue();
    }

    @Test
    void chavesMaisAntigasSaemQuandoOMapaEnche() {
        RateLimiter limiter = limiter(10);
        for (int i = 0; i < 11; i++) {
            limiter.tentar("login:ip-" + i, 5, Duration.ofHours(1));
            relogio.avancar(Duration.ofMillis(1));
        }

        assertThat(limiter.temChave("login:ip-0")).as("chave mais antiga evictada").isFalse();
        assertThat(limiter.temChave("login:ip-10")).as("chave mais recente preservada").isTrue();
    }

    @Test
    void chaveQueEstaBarrandoSoBreviveAEviccao() {
        RateLimiter limiter = limiter(10);
        String alvo = "login-email:alvo@example.com";
        limiter.tentar(alvo, 1, Duration.ofHours(1)); // bloqueada e a MAIS ANTIGA

        // Chaves abaixo do próprio limite, mais recentes que o alvo.
        for (int i = 0; i < 9; i++) {
            relogio.avancar(Duration.ofMillis(1));
            limiter.tentar("login:ip-" + i, 5, Duration.ofHours(1));
        }
        relogio.avancar(Duration.ofMillis(1));
        limiter.tentar("login:ip-9", 5, Duration.ofHours(1)); // chave nova dispara a evicção

        // Sem a ordem por "bloqueada", a mais antiga (o alvo) sairia e o teto
        // por e-mail dele zeraria — exatamente o ataque que o teto deve impedir.
        assertThat(limiter.temChave(alvo)).as("chave que está barrando preservada").isTrue();
        assertThat(limiter.temChave("login:ip-0")).as("chave mais antiga sem bloqueio saiu").isFalse();
    }

    @Test
    void janelaNovaPassaAValerNaProximaChamada() {
        RateLimiter limiter = limiter(100_000);
        String chave = "login-email:alvo@example.com";

        assertThat(limiter.tentar(chave, 1, Duration.ofHours(1))).isEmpty();
        assertThat(limiter.tentar(chave, 1, Duration.ofHours(1))).as("teto de 1 h").isPresent();

        relogio.avancar(Duration.ofMillis(20));
        // A chamada agora declara uma janela de 1 ms: a tentativa antiga vence.
        assertThat(limiter.tentar(chave, 1, Duration.ofMillis(1)))
            .as("a chave passa a usar a janela nova")
            .isEmpty();
    }

    @Test
    void limparUmaChaveNaoAfetaAsOutras() {
        RateLimiter limiter = limiter(100_000);
        String a = "login:ip-a";
        String b = "login:ip-b";
        assertThat(limiter.tentar(a, 1, Duration.ofMinutes(1))).isEmpty();
        assertThat(limiter.tentar(b, 1, Duration.ofMinutes(1))).isEmpty();

        limiter.limpar(a); // login certo zera só as chaves daquela tentativa

        assertThat(limiter.tentar(a, 1, Duration.ofMinutes(1))).isEmpty();
        assertThat(limiter.tentar(b, 1, Duration.ofMinutes(1))).isPresent();
    }

    private static final class RelogioFalso extends Clock {

        private Instant agora = Instant.parse("2026-01-01T12:00:00Z");

        void avancar(Duration duracao) {
            agora = agora.plus(duracao);
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zona) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }
}
