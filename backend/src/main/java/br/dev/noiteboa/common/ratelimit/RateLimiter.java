package br.dev.noiteboa.common.ratelimit;

import org.springframework.stereotype.Component;

import java.time.Clock;
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
     * saem primeiro as chaves que NÃO estão barrando tentativas e, entre elas, as
     * de uso mais antigo — quem está sob ataque é tocado a cada tentativa e
     * permanece "bloqueada", então é o último a sair (#268).
     */
    private static final int MAX_CHAVES = 100_000;

    private final int limparQuandoMaioresQue;
    private final long intervaloLimpezaNanos;
    private final int maxChaves;
    private final Clock relogio;

    /** Quando foi a última varredura (nanoTime, monotônico). */
    private final AtomicLong ultimaLimpeza = new AtomicLong(System.nanoTime());

    /** Uma varredura por vez: um mapa grande não pode ter duas em paralelo. */
    private final AtomicBoolean varrendo = new AtomicBoolean();

    /** Uma liberação de espaço por vez. */
    private final AtomicBoolean liberandoEspaco = new AtomicBoolean();

    /** Relógio vem do contexto ({@link br.dev.noiteboa.common.TimeConfig}) para o teste
     *  controlar a janela sem dormir (#279). */
    @org.springframework.beans.factory.annotation.Autowired
    public RateLimiter(Clock relogio) {
        this(LIMPAR_QUANDO_MAIORES_QUE, INTERVALO_LIMPEZA, MAX_CHAVES, relogio);
    }

    RateLimiter(int limparQuandoMaioresQue, Duration intervaloLimpeza) {
        this(limparQuandoMaioresQue, intervaloLimpeza, MAX_CHAVES, Clock.systemUTC());
    }

    RateLimiter(int limparQuandoMaioresQue, Duration intervaloLimpeza, int maxChaves) {
        this(limparQuandoMaioresQue, intervaloLimpeza, maxChaves, Clock.systemUTC());
    }

    /** Tudo configurável: o teste não cria 100 mil chaves, não espera e controla o tempo. */
    RateLimiter(int limparQuandoMaioresQue, Duration intervaloLimpeza, int maxChaves, Clock relogio) {
        this.limparQuandoMaioresQue = limparQuandoMaioresQue;
        this.intervaloLimpezaNanos = intervaloLimpeza.toNanos();
        this.maxChaves = maxChaves;
        this.relogio = relogio;
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
            Entrada entrada = tentativas.computeIfAbsent(chave, k -> new Entrada(janela, relogio.instant()));
            synchronized (entrada.fila) {
                if (tentativas.get(chave) != entrada) {
                    // A limpeza, o `limpar` ou a evicção descartou esta entrada
                    // enquanto chegávamos; sem esta checagem a tentativa ficaria
                    // numa fila solta e escaparia do limite (#268).
                    continue;
                }
                entrada.janela = janela; // a limpeza usa a janela vigente da chave
                Instant agora = relogio.instant(); // dentro do lock: a fila fica em ordem
                Instant corte = agora.minus(entrada.janela);
                while (!entrada.fila.isEmpty() && entrada.fila.peekFirst().isBefore(corte)) {
                    entrada.fila.pollFirst();
                }
                entrada.ultima = agora; // uso recente, mesmo quando a tentativa é barrada
                if (entrada.fila.size() >= limite) {
                    entrada.bloqueada = true;
                    return Optional.of(Duration.between(agora, entrada.fila.peekFirst().plus(entrada.janela)));
                }
                entrada.fila.addLast(agora);
                entrada.bloqueada = entrada.fila.size() >= limite;
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
        if (System.nanoTime() - ultimaLimpeza.get() < intervaloLimpezaNanos) {
            return; // limpou há pouco
        }
        if (!varrendo.compareAndSet(false, true)) {
            return; // outra requisição está varrendo
        }
        try {
            long agora = System.nanoTime();
            if (agora - ultimaLimpeza.get() < intervaloLimpezaNanos) {
                return; // outra varredura terminou enquanto esperávamos a flag
            }
            ultimaLimpeza.set(agora);
            limparVencidas();
        } finally {
            varrendo.set(false);
        }
    }

    private void limparVencidas() {
        Instant agora = relogio.instant();
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

    /**
     * Remove as chaves menos críticas até folgar 10% do teto. A ordem é:
     * primeiro as que não estão barrando tentativas, depois as bloqueadas;
     * dentro de cada grupo, a de uso mais antigo. Chaves tocadas depois do
     * snapshot são poupadas na primeira passada.
     */
    private void liberarEspaco() {
        if (!liberandoEspaco.compareAndSet(false, true)) {
            return; // outra requisição já está liberando espaço
        }
        try {
            int alvo = maxChaves - maxChaves / 10;
            List<Candidata> candidatas = new ArrayList<>(tentativas.size());
            for (Map.Entry<String, Entrada> e : tentativas.entrySet()) {
                Entrada entrada = e.getValue();
                candidatas.add(new Candidata(e.getKey(), entrada, entrada.ultima, entrada.bloqueada));
            }
            // Ordena sobre valores capturados: ler `ultima` ao vivo no comparador
            // pode mudar a ordem no meio do sort e lançar IllegalArgumentException.
            candidatas.sort(Comparator.comparing(Candidata::bloqueada).thenComparing(Candidata::ultima));

            for (Candidata c : candidatas) {
                if (tentativas.size() <= alvo) {
                    break;
                }
                synchronized (c.entrada().fila) {
                    if (c.entrada().ultima.isAfter(c.ultima())) {
                        continue; // foi usada depois do snapshot: poupa
                    }
                    tentativas.remove(c.chave(), c.entrada());
                }
            }

            // Segunda passada: memória primeiro. Se as chaves foram todas tocadas
            // durante a evicção, ainda assim o teto precisa valer.
            for (Candidata c : candidatas) {
                if (tentativas.size() <= alvo) {
                    break;
                }
                synchronized (c.entrada().fila) {
                    tentativas.remove(c.chave(), c.entrada());
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

    /** Candidata à evicção com os valores capturados no snapshot. */
    private record Candidata(String chave, Entrada entrada, Instant ultima, boolean bloqueada) {
    }

    /** Tentativas de uma chave, a janela vigente e o último uso (para a evicção). */
    private static final class Entrada {
        private final Deque<Instant> fila = new ConcurrentLinkedDeque<>();
        private volatile Duration janela;
        private volatile Instant ultima;
        private volatile boolean bloqueada;

        private Entrada(Duration janela, Instant agora) {
            this.janela = janela;
            this.ultima = agora;
        }
    }
}
