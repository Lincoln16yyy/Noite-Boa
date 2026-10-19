package br.dev.noiteboa.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

import java.time.Duration;

/**
 * Issue #268: a limpeza de chaves vencidas podava TODAS as chaves com a janela
 * da chamada atual. Um login (60 s) esvaziava as tentativas de `login-email`
 * (1 h) e enfraquecia o teto por e-mail justamente quando o mapa cresce
 * (cenário de ataque), abrindo espaço para brute force de uma conta.
 */
class RateLimiterTest {

    /** Gatilho baixo e limpeza sem intervalo para o teste não criar 50 mil chaves nem esperar. */
    private static RateLimiter limiterDeTeste() {
        return new RateLimiter(10, Duration.ZERO);
    }

    @Test
    void limpezaNaoAfrouxaOTetoDeUmaChaveComJanelaLonga() throws InterruptedException {
        RateLimiter limiter = limiterDeTeste();
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
        Thread.sleep(20);

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
    void limpezaRemoveAsChavesDeJanelaCurtaVencidas() throws InterruptedException {
        RateLimiter limiter = limiterDeTeste();
        String email = "login-email:alvo@example.com";
        limiter.tentar(email, 3, Duration.ofHours(1));

        for (int i = 0; i < 12; i++) {
            limiter.tentar("login:ip-" + i, 5, Duration.ofMillis(1));
        }
        Thread.sleep(20); // as chaves curtas venceram

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
    void limpezaNaoRodaDentroDoIntervalo() throws InterruptedException {
        // Intervalo de 1 h: a varredura não pode acontecer a cada requisição.
        RateLimiter limiter = new RateLimiter(10, Duration.ofHours(1));
        for (int i = 0; i < 12; i++) {
            limiter.tentar("login:ip-" + i, 5, Duration.ofMillis(1));
        }
        Thread.sleep(20);
        limiter.tentar("login:gatilho", 5, Duration.ofMillis(1));

        assertThat(limiter.temChave("login:ip-0"))
            .as("sem varredura dentro do intervalo")
            .isTrue();
    }

    @Test
    void chavesMaisAntigasSaemQuandoOMapaEnche() throws InterruptedException {
        RateLimiter limiter = new RateLimiter(1_000, Duration.ofHours(1), 10);
        for (int i = 0; i < 11; i++) {
            limiter.tentar("login:ip-" + i, 5, Duration.ofHours(1));
            Thread.sleep(2); // garante ordem de "última tentativa"
        }

        assertThat(limiter.temChave("login:ip-0")).as("chave mais antiga evictada").isFalse();
        assertThat(limiter.temChave("login:ip-10")).as("chave mais recente preservada").isTrue();
    }

    @Test
    void chaveEmUsoRecenteSobreviveAEviccao() throws InterruptedException {
        RateLimiter limiter = new RateLimiter(1_000, Duration.ofHours(1), 10);
        String alvo = "login-email:alvo@example.com";
        limiter.tentar(alvo, 1, Duration.ofHours(1)); // a mais antiga
        for (int i = 0; i < 9; i++) {
            limiter.tentar("login:ip-" + i, 1, Duration.ofHours(1));
            Thread.sleep(2);
        }

        // Toque recente no alvo: mesmo barrado (limite 1), conta como uso.
        assertThat(limiter.tentar(alvo, 1, Duration.ofHours(1))).isPresent();
        Thread.sleep(2);
        limiter.tentar("login:ip-9", 1, Duration.ofHours(1)); // chave nova dispara a evicção

        assertThat(limiter.temChave(alvo)).as("chave em uso preservada").isTrue();
        assertThat(limiter.temChave("login:ip-0")).as("chave mais antiga saiu").isFalse();
    }

    @Test
    void janelaNovaPassaAValerNaProximaChamada() throws InterruptedException {
        RateLimiter limiter = limiterDeTeste();
        String chave = "login-email:alvo@example.com";

        assertThat(limiter.tentar(chave, 1, Duration.ofHours(1))).isEmpty();
        assertThat(limiter.tentar(chave, 1, Duration.ofHours(1))).as("teto de 1 h").isPresent();

        Thread.sleep(20);
        // A chamada agora declara uma janela de 1 ms: a tentativa antiga vence.
        assertThat(limiter.tentar(chave, 1, Duration.ofMillis(1)))
            .as("a chave passa a usar a janela nova")
            .isEmpty();
    }

    @Test
    void limparUmaChaveNaoAfetaAsOutras() {
        RateLimiter limiter = limiterDeTeste();
        String a = "login:ip-a";
        String b = "login:ip-b";
        assertThat(limiter.tentar(a, 1, Duration.ofMinutes(1))).isEmpty();
        assertThat(limiter.tentar(b, 1, Duration.ofMinutes(1))).isEmpty();

        limiter.limpar(a); // login certo zera só as chaves daquela tentativa

        assertThat(limiter.tentar(a, 1, Duration.ofMinutes(1))).isEmpty();
        assertThat(limiter.tentar(b, 1, Duration.ofMinutes(1))).isPresent();
    }
}
