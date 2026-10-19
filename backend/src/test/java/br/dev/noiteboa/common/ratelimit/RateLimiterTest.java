package br.dev.noiteboa.common.ratelimit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Issue #268: a limpeza de chaves vencidas podava TODAS as chaves com a janela
 * da chamada atual. Um login (60 s) esvaziava as tentativas de `login-email`
 * (1 h) e enfraquecia o teto por e-mail justamente quando o mapa cresce
 * (cenário de ataque), abrindo espaço para brute force de uma conta.
 */
class RateLimiterTest {

    @Test
    void limpezaNaoSeRepeteEnquantoOIntervaloNaoPassa() {
        AtomicLong tempo = new AtomicLong();
        RateLimiter limiter = new RateLimiter(1, tempo::get);
        Map<?, ?> entradas = spy(new ConcurrentHashMap<>());
        ReflectionTestUtils.setField(limiter, "tentativas", entradas);

        assertThat(limiter.tentar("login:primeiro", 5, Duration.ofHours(1))).isEmpty();
        verify(entradas, never()).entrySet();

        for (int i = 0; i < 10; i++) {
            assertThat(limiter.tentar("login:ip-" + i, 5, Duration.ofHours(1))).isEmpty();
        }

        verify(entradas, times(1)).entrySet();

        tempo.set(Duration.ofMinutes(1).toNanos() - 1);
        assertThat(limiter.tentar("login:antes-do-intervalo", 5, Duration.ofHours(1))).isEmpty();
        verify(entradas, times(1)).entrySet();

        tempo.incrementAndGet();
        assertThat(limiter.tentar("login:no-intervalo", 5, Duration.ofHours(1))).isEmpty();
        verify(entradas, times(2)).entrySet();

        assertThat(limiter.tentar("login:mesmo-instante", 5, Duration.ofHours(1))).isEmpty();
        verify(entradas, times(2)).entrySet();
    }

    @Test
    void chamadasConcorrentesDisparamUmaUnicaLimpezaPorIntervalo() throws Exception {
        AtomicLong tempo = new AtomicLong();
        RateLimiter limiter = new RateLimiter(1, tempo::get);
        Map<?, ?> entradas = spy(new ConcurrentHashMap<>());
        ReflectionTestUtils.setField(limiter, "tentativas", entradas);
        limiter.tentar("login:primeiro", 5, Duration.ofHours(1));

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int intervalo = 0; intervalo < 2; intervalo++) {
                tempo.set(Duration.ofMinutes(intervalo).toNanos());
                CyclicBarrier inicio = new CyclicBarrier(16);
                var resultados = new ArrayList<Future<?>>();
                for (int i = 0; i < 16; i++) {
                    String chave = "login:concorrente-" + intervalo + "-" + i;
                    resultados.add(executor.submit(() -> {
                        inicio.await(5, TimeUnit.SECONDS);
                        assertThat(limiter.tentar(chave, 5, Duration.ofHours(1))).isEmpty();
                        return null;
                    }));
                }
                for (Future<?> resultado : resultados) {
                    resultado.get(10, TimeUnit.SECONDS);
                }
                verify(entradas, times(intervalo + 1)).entrySet();
            }
        }
    }

    @Test
    void limpezaNaoAfrouxaOTetoDeUmaChaveComJanelaLonga() throws InterruptedException {
        // Gatilho baixo para o teste não precisar criar 50 mil chaves.
        RateLimiter limiter = new RateLimiter(10);
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
    void janelaNovaPassaAValerNaProximaChamada() throws InterruptedException {
        RateLimiter limiter = new RateLimiter(10);
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
        RateLimiter limiter = new RateLimiter(10);
        String a = "login:ip-a";
        String b = "login:ip-b";
        assertThat(limiter.tentar(a, 1, Duration.ofMinutes(1))).isEmpty();
        assertThat(limiter.tentar(b, 1, Duration.ofMinutes(1))).isEmpty();

        limiter.limpar(a); // login certo zera só as chaves daquela tentativa

        assertThat(limiter.tentar(a, 1, Duration.ofMinutes(1))).isEmpty();
        assertThat(limiter.tentar(b, 1, Duration.ofMinutes(1))).isPresent();
    }
}
