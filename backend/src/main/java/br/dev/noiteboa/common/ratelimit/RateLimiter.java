package br.dev.noiteboa.common.ratelimit;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicBoolean;
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

    /**
     * Teto de chaves. Sem ele, um atacante que tenta login com milhões de e-mails
     * distintos (cada chave vive 1 h) esgota o heap e derruba o serviço. Ao encher,
     * saem as chaves com a tentativa mais antiga — uma conta sob ataque está sempre
     * "recente", então continua protegida (#268).
     */
    private static final int MAX_CHAVES = 100_000;

    private final int limparQuandoMaioresQue;
    private final long intervaloLimpezaNanos;
    private final int maxChaves;

    /** Quando foi a última varredura (nanoTime). */
    private final AtomicLong ultimaLimpeza = new AtomicLong(System.nanoTime());

    /** Uma varredura por vez: um mapa grande não pode ter duas em paralelo. */
    private final AtomicBoolean varrendo = new AtomicBoolean();

    /** Uma liberação de espaço por vez. */
    private final AtomicBoolean liberandoEspaco = new AtomicBoolean();

    public RateLimiter() {
        this(LIMPAR_QUANDO_MAIORES_QUE, INTERVALO_LIMPEZA, MAX_CHAVES);
    }

    RateLimiter(int limparQuandoMaioresQue, Duration intervaloLimpeza) {
        this(limparQuandoMaioresQue, intervaloLimpeza, MAX_CHAVES);
    }

    /** Tudo configurável: o teste não cria 100 mil chaves nem espera 10 s. */
    RateLimiter(int limparQuandoMaioresQue, Duration intervaloLimpeza, int maxChaves) {
        this.limparQuandoMaioresQue = limparQuandoMaioresQue;
        this.intervaloLimpezaNanos = intervaloLimpeza.toNanos();
        this.maxChaves = maxChaves;
    }

    /**
     * Registra uma tentativa na chave.
     * Devolve empty se dentro do limite; se estourou, devolve o tempo restante
     * da janela (para o cabeçalho Retry-After) e a tentativa não é contada.
     */
    public Optional<Duration> tentar(String chave, int limite, Duration janela) {
        for (;;) {
            if (tentativas.size() >= maxChaves && !tentativas.containsKey(chave)) {
                // Só uma chave nova dispara evicção: uma chave em uso não pode
                // ser descartada pela própria requisição que a está usando.
                liberarEspaco();
            }
            Entrada entrada = tentativas.computeIfAbsent(chave, k -> new Entrada(janela));
            synchronized (entrada.fila) {
                if (tentativas.get(chave) != entrada) {
                    // A limpeza, o `limpar` ou a evicção descartou esta entrada
                    // enquanto chegávamos; sem esta checagem a tentativa ficaria
                    // numa fila solta e escaparia do limite (#268).
                    continue;
                }
                entrada.janela = janela; // a limpeza usa a janela vigente da chave
                Instant agora = Instant.now(); // dentro do lock: a fila fica em ordem
                Instant corte = agora.minus(entrada.janela);
                while (!entrada.fila.isEmpty() && entrada.fila.peekFirst().isBefore(corte)) {
                    entrada.fila.pollFirst();
                }
                entrada.ultima = agora; // uso recente, mesmo quando a tentativa é barrada
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
        Entrada entrada = tentativas.get(chave);
        if (entrada == null) {
            return;
        }
        synchronized (entrada.fila) {
            // Sob o lock dos appends: um `tentar` concorrente não anota numa
            // entrada já solta e perde a tentativa (#268).
            tentativas.remove(chave, entrada);
        }
    }

    /**
     * Varre o mapa no máximo uma vez por intervalo e nunca em paralelo: sob
     * ataque o mapa fica grande por até 1 h (janela das chaves de e-mail), e
     * varrer tudo a cada requisição viraria custo de CPU do atacante (#268).
     */
    private void limparSeNecessario() {
        long agora = System.nanoTime();
        if (agora - ultimaLimpeza.get() < intervaloLimpezaNanos) {
            return; // limpou há pouco
        }
        if (!varrendo.compareAndSet(false, true)) {
            return; // outra requisição está varrendo
        }
        try {
            ultimaLimpeza.set(agora);
            limparVencidas();
        } finally {
            varrendo.set(false);
        }
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

    /** Remove as chaves com a tentativa mais antiga até folgar 10% do teto. */
    private void liberarEspaco() {
        if (!liberandoEspaco.compareAndSet(false, true)) {
            return; // outra requisição já está liberando espaço
        }
        try {
            int alvo = maxChaves - maxChaves / 10;
            List<Map.Entry<String, Entrada>> maisAntigas = new ArrayList<>(tentativas.entrySet());
            maisAntigas.sort(Comparator.comparing(e -> e.getValue().ultima));
            for (Map.Entry<String, Entrada> e : maisAntigas) {
                if (tentativas.size() <= alvo) {
                    break;
                }
                synchronized (e.getValue().fila) {
                    tentativas.remove(e.getKey(), e.getValue());
                }
            }
        } finally {
            liberandoEspaco.set(false);
        }
    }

    /** Visível ao teste: prova que a limpeza/evicção podou (ou preservou) a entrada. */
    boolean temChave(String chave) {
        return tentativas.containsKey(chave);
    }

    /** Tentativas de uma chave, a janela vigente e o último uso (para a evicção). */
    private static final class Entrada {
        private final Deque<Instant> fila = new ConcurrentLinkedDeque<>();
        private volatile Duration janela;
        private volatile Instant ultima;

        private Entrada(Duration janela) {
            this.janela = janela;
            this.ultima = Instant.now();
        }
    }
}
