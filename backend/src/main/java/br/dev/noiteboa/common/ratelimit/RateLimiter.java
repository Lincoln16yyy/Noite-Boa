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

    private final Map<String, Deque<Instant>> tentativas = new ConcurrentHashMap<>();

    /** Acima disto, varre entradas já vencidas para não reter memória de chaves mortas. */
    private static final int LIMPAR_QUANDO_MAIORES_QUE = 50_000;

    /**
     * Registra uma tentativa na chave.
     * Devolve empty se dentro do limite; se estourou, devolve o tempo restante
     * da janela (para o cabeçalho Retry-After) e a tentativa não é contada.
     */
    public Optional<Duration> tentar(String chave, int limite, Duration janela) {
        Instant agora = Instant.now();
        Instant corte = agora.minus(janela);
        Deque<Instant> fila = tentativas.computeIfAbsent(chave, k -> new ConcurrentLinkedDeque<>());
        synchronized (fila) {
            while (!fila.isEmpty() && fila.peekFirst().isBefore(corte)) {
                fila.pollFirst();
            }
            if (fila.size() >= limite) {
                return Optional.of(Duration.between(agora, fila.peekFirst().plus(janela)));
            }
            fila.addLast(agora);
        }
        if (tentativas.size() > LIMPAR_QUANDO_MAIORES_QUE) {
            limparVencidas(janela);
        }
        return Optional.empty();
    }

    /** Zera a chave (ex.: um login bem-sucedido não conta contra o usuário). */
    public void limpar(String chave) {
        tentativas.remove(chave);
    }

    private void limparVencidas(Duration janela) {
        Instant corte = Instant.now().minus(janela);
        tentativas.entrySet().removeIf(e -> {
            Deque<Instant> fila = e.getValue();
            synchronized (fila) {
                while (!fila.isEmpty() && fila.peekFirst().isBefore(corte)) {
                    fila.pollFirst();
                }
                return fila.isEmpty();
            }
        });
    }
}
