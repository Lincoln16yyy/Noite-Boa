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
 * Issue #269: a limpeza da suíte não pode apagar dados que não sejam de teste.
 *
 * <p>O banco usado nos testes é o mesmo do desenvolvimento, então remover uma
 * conta real (e-mail fora de {@code @example.com}) seria destrutivo. Este teste
 * prova as duas metades: o dado de teste some (com os filhos, via cascade) e o
 * dado "real" permanece.</p>
 */
@SpringBootTest
class LimpezaDeTesteNaoApagaDadosReaisTest {

    @Autowired
    UserRepository userRepository;

    @Autowired
    SleepLogRepository sleepLogRepository;

    @Test
    void limpezaApagaDadosDeTesteEPreservaDadosReais() {
        User deTeste = usuario("limpeza-teste@example.com");
        User real = usuario("dados-reais-do-dev@noiteboa.local");
        SleepLog logDeTeste = noite(deTeste);
        SleepLog logReal = noite(real);

        try {
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
            sleepLogRepository.deleteById(logReal.getId());
            userRepository.deleteById(real.getId());
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
