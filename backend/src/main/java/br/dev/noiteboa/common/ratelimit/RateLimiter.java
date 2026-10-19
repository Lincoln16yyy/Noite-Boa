package br.dev.noiteboa.common.ratelimit;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Deque;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

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

    private final int limparQuandoMaioresQue;

    public RateLimiter() {
        this(LIMPAR_QUANDO_MAIORES_QUE);
    }

    /** Gatilho configurável: o teste não precisa criar 50 mil chaves. */
    RateLimiter(int limparQuandoMaioresQue) {
        this.limparQuandoMaioresQue = limparQuandoMaioresQue;
    }

    /**
     * Registra uma tentativa na chave.
     * Devolve empty se dentro do limite; se estourou, devolve o tempo restante
     * da janela (para o cabeçalho Retry-After) e a tentativa não é contada.
     */
    public Optional<Duration> tentar(String chave, int limite, Duration janela) {
        Instant agora = Instant.now();
        Entrada entrada = tentativas.computeIfAbsent(chave, k -> new Entrada(janela));
        entrada.janela = janela; // se a configuração mudar, a limpeza passa a usar a nova
        synchronized (entrada.fila) {
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
            limparVencidas();
        }
        return Optional.empty();
    }

    /** Zera a chave (ex.: um login bem-sucedido não conta contra o usuário). */
    public void limpar(String chave) {
        tentativas.remove(chave);
    }

    private void limparVencidas() {
        Instant agora = Instant.now();
        tentativas.entrySet().removeIf(e -> {
            Entrada entrada = e.getValue();
            synchronized (entrada.fila) {
                // Cada chave é podada com a PRÓPRIA janela (#268): usar a janela
                // da chamada atual esvaziaria o teto de 1 h quando um login (60 s)
                // disparasse a limpeza.
                Instant corte = agora.minus(entrada.janela);
                while (!entrada.fila.isEmpty() && entrada.fila.peekFirst().isBefore(corte)) {
                    entrada.fila.pollFirst();
                }
                return entrada.fila.isEmpty();
            }
        });
    }

    /** Tentativas de uma chave e a janela com que ela foi criada. */
    private static final class Entrada {
        private final Deque<Instant> fila = new ConcurrentLinkedDeque<>();
        private volatile Duration janela;

        private Entrada(Duration janela) {
            this.janela = janela;
        }
    }
}
