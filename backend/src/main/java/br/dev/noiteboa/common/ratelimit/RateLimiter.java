package br.dev.noiteboa.common.ratelimit;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Deque;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Limitador de tentativas em memória (issue #104) — sem dependência nova.
 *
 * Janela deslizante por chave: guarda os horários das tentativas dentro da
 * janela e remove os vencidos no próprio acesso (autolimpeza). Uma instância
 * por processo basta para o app atual (um único dyno na Render); se um dia
 * houver vários processos, o limite passa a ser por processo e aí sim seria
 * preciso Redis (fora do escopo da issue).
 */
@Component
public class RateLimiter {

    /** Cada chave guarda a própria janela, para a limpeza não usar a de outra (#268). */
    private final Map<String, Entrada> tentativas = new ConcurrentHashMap<>();

    /** Acima disto, varre entradas já vencidas para não reter memória de chaves mortas. */
    private static final int LIMPAR_QUANDO_MAIORES_QUE = 50_000;

    /** Intervalo mínimo entre varreduras: sem isso, todo login varreria o mapa inteiro. */
    private static final Duration INTERVALO_LIMPEZA = Duration.ofSeconds(10);

    private final int limparQuandoMaioresQue;
    private final long intervaloLimpezaNanos;

    /** Quando foi a última varredura (nanoTime). */
    private final AtomicLong ultimaLimpeza = new AtomicLong(System.nanoTime());

    public RateLimiter() {
        this(LIMPAR_QUANDO_MAIORES_QUE, INTERVALO_LIMPEZA);
    }

    /** Gatilho e intervalo configuráveis: o teste não precisa criar 50 mil chaves nem esperar 10 s. */
    RateLimiter(int limparQuandoMaioresQue, Duration intervaloLimpeza) {
        this.limparQuandoMaioresQue = limparQuandoMaioresQue;
        this.intervaloLimpezaNanos = intervaloLimpeza.toNanos();
    }

    /**
     * Registra uma tentativa na chave.
     * Devolve empty se dentro do limite; se estourou, devolve o tempo restante
     * da janela (para o cabeçalho Retry-After) e a tentativa não é contada.
     */
    public Optional<Duration> tentar(String chave, int limite, Duration janela) {
        for (;;) {
            Instant agora = Instant.now();
            Entrada entrada = tentativas.computeIfAbsent(chave, k -> new Entrada(janela));
            synchronized (entrada.fila) {
                if (tentativas.get(chave) != entrada) {
                    // A limpeza descartou esta entrada enquanto chegávamos. Sem esta
                    // checagem, a tentativa ficaria numa fila solta e escaparia do
                    // limite; recomeça na entrada nova (#268).
                    continue;
                }
                entrada.janela = janela; // a limpeza usa a janela vigente da chave
                Instant corte = agora.minus(entrada.janela);
                while (!entrada.fila.isEmpty() && entrada.fila.peekFirst().isBefore(corte)) {
                    entrada.fila.pollFirst();
                }
                if (entrada.fila.size() >= limite) {
                    return Optional.of(Duration.between(agora, entrada.fila.peekFirst().plus(entrada.janela)));
                }
                entrada.fila.addLast(agora);
            }
            if (tentativas.size() > limparQuandoMaioresQue) {
                limparSeNecessario();
            }
            return Optional.empty();
        }
    }

    /** Zera a chave (ex.: um login bem-sucedido não conta contra o usuário). */
    public void limpar(String chave) {
        tentativas.remove(chave);
    }

    /**
     * Varre o mapa no máximo uma vez por {@link #INTERVALO_LIMPEZA}: sob ataque o
     * mapa fica grande por até 1 h (janela das chaves de e-mail), e varrer tudo a
     * cada requisição viraria um custo de CPU controlado pelo atacante (#268).
     */
    private void limparSeNecessario() {
        long agora = System.nanoTime();
        long anterior = ultimaLimpeza.get();
        if (agora - anterior < intervaloLimpezaNanos) {
            return; // já houve varredura há pouco
        }
        if (!ultimaLimpeza.compareAndSet(anterior, agora)) {
            return; // outra requisição assumiu a varredura
        }
        limparVencidas();
    }

    private void limparVencidas() {
        Instant agora = Instant.now();
        for (Map.Entry<String, Entrada> e : tentativas.entrySet()) {
            Entrada entrada = e.getValue();
            synchronized (entrada.fila) {
                // Cada chave é podada com a PRÓPRIA janela (#268): usar a janela
                // da chamada atual esvaziaria o teto de 1 h quando um login (60 s)
                // disparasse a limpeza.
                Instant corte = agora.minus(entrada.janela);
                while (!entrada.fila.isEmpty() && entrada.fila.peekFirst().isBefore(corte)) {
                    entrada.fila.pollFirst();
                }
                if (entrada.fila.isEmpty()) {
                    // Remover sob o lock dos appends: uma tentativa concorrente não
                    // pode cair numa entrada já descartada (#268).
                    tentativas.remove(e.getKey(), entrada);
                }
            }
        }
    }

    /** Visível ao teste: prova que a limpeza podou (ou preservou) a entrada. */
    boolean temChave(String chave) {
        return tentativas.containsKey(chave);
    }

    /** Tentativas de uma chave e a janela vigente dela. */
    private static final class Entrada {
        private final Deque<Instant> fila = new ConcurrentLinkedDeque<>();
        private volatile Duration janela;

        private Entrada(Duration janela) {
            this.janela = janela;
        }
    }
}
