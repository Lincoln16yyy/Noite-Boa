package br.dev.noiteboa.support;

import static org.assertj.core.api.Assertions.assertThat;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.sleep.SleepLog;
import br.dev.noiteboa.sleep.SleepLogRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Issue #269: a limpeza da suíte não apaga dados fora do marcador de teste.
 *
 * <p>Este teste nasceu quando a suíte rodava no mesmo banco do desenvolvimento.
 * Hoje o banco é efêmero (Testcontainers, #270), mas a limpeza continua
 * filtrando por {@code @example.com}: aqui ficam provadas as duas metades — o
 * dado de teste some (com os filhos, via cascade) e um e-mail fora do marcador
 * permanece.</p>
 */
@SpringBootTest
class LimpezaDeTesteNaoApagaDadosReaisTest extends TesteComBanco {

    @Autowired
    UserRepository userRepository;

    @Autowired
    SleepLogRepository sleepLogRepository;

    @Test
    void limpezaApagaDadosDeTesteEPreservaDadosReais() {
        // Criadas DENTRO do try: se o setup falhar, o finally ainda limpa as duas
        // contas. E-mails únicos por execução para não colidir com sobras de uma
        // rodada interrompida (review do PR #284).
        User deTeste = null;
        User real = null;
        SleepLog logReal = null;

        try {
            deTeste = usuario("limpeza-teste-" + UUID.randomUUID() + "@example.com");
            real = usuario("dados-reais-" + UUID.randomUUID() + "@noiteboa.local");
            SleepLog logDeTeste = noite(deTeste);
            logReal = noite(real);

            LimpezaDeTeste.limpar(userRepository);

            assertThat(userRepository.findById(deTeste.getId())).isEmpty();
            assertThat(sleepLogRepository.findById(logDeTeste.getId()))
                .as("o cascade deveria levar a noite da conta de teste")
                .isEmpty();

            assertThat(userRepository.findById(real.getId())).isPresent();
            assertThat(sleepLogRepository.findById(logReal.getId()))
                .as("a noite do usuário real não pode ser apagada")
                .isPresent();
        } finally {
            // findById + ifPresent: o dado de teste já pode ter sido apagado pela
            // própria limpeza, e apagar de novo não pode estourar.
            if (logReal != null) {
                UUID id = logReal.getId();
                sleepLogRepository.findById(id).ifPresent(sleepLogRepository::delete);
            }
            if (real != null) {
                UUID id = real.getId();
                userRepository.findById(id).ifPresent(userRepository::delete);
            }
            if (deTeste != null) {
                UUID id = deTeste.getId();
                userRepository.findById(id).ifPresent(userRepository::delete);
            }
        }
    }

    private User usuario(String email) {
        return userRepository.save(
            new User(UUID.randomUUID(), email, "hash-de-teste", "Teste", OffsetDateTime.now()));
    }

    private SleepLog noite(User user) {
        OffsetDateTime inicio = OffsetDateTime.now().minusHours(10);
        return sleepLogRepository.saveAndFlush(
            new SleepLog(UUID.randomUUID(), user, inicio, inicio.plusHours(8), (short) 4, null));
    }
}
