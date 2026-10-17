package br.dev.noiteboa;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.sleep.SleepLog;
import br.dev.noiteboa.sleep.SleepLogRepository;
import br.dev.noiteboa.sleep.SleepService;
import br.dev.noiteboa.sleep.dto.CreateSleepLogRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Issue #265: a integridade do período não pode depender só do serviço.
 *
 * `SleepService.assertSemSobreposicao` faz um SELECT e só depois o INSERT, então
 * duas transações simultâneas passam pela checagem e gravam as duas noites. Os
 * testes abaixo gravam direto pelo repositório, de propósito: é assim que a
 * segunda transação se comporta quando a primeira já passou pela checagem —
 * sem depender de um teste de corrida com threads, que passaria ou falharia
 * conforme o escalonador.
 */
@SpringBootTest
class SleepLogOverlapNoBancoTest {

    @Autowired
    SleepService sleepService;

    @Autowired
    UserRepository userRepository;

    /** Spy sobre o repositório real: permite simular a checagem "passando" na corrida. */
    @MockitoSpyBean
    SleepLogRepository sleepLogRepository;

    /** Só os usuários criados aqui — o cleanup não encosta no que não é desta classe. */
    private final List<UUID> usuariosCriados = new ArrayList<>();

    @AfterEach
    void cleanup() {
        // Apaga pelos ids criados nesta classe (o ON DELETE CASCADE leva as
        // noites junto). Não filtra por domínio @example.com: outra classe de
        // teste pode ter contas dessas em uso, e apagar o que não é nosso é
        // justamente o problema da #269 (review do PR #281).
        usuariosCriados.forEach(userRepository::deleteById);
        usuariosCriados.clear();
    }

    // ---- o banco é a última linha de defesa ----

    @Test
    void bancoRejeitaNoitesSobrepostas() {
        OffsetDateTime base = OffsetDateTime.now();
        User user = usuario("sobrepostas@example.com");
        salvarNoite(user, base.minusHours(26), base.minusHours(18));

        // Mesmo período, gravado direto: o serviço não está no caminho
        assertThatThrownBy(() -> salvarNoite(user, base.minusHours(20), base.minusHours(12)))
            .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(noitesDoUsuario(user)).isEqualTo(1);
    }

    @Test
    void bancoPermiteRegistrosAdjacentes() {
        OffsetDateTime base = OffsetDateTime.now();
        User user = usuario("adjacentes@example.com");

        // Fim de um == início do outro, sem buraco nenhum: é a fronteira que o
        // tstzrange [início, fim) tem de aceitar. Derivar os dois intervalos do
        // mesmo instante é essencial — com dois now() diferentes o segundo
        // período começaria depois do fim do primeiro e o teste não exerceria
        // adjacência de verdade (review do PR #281).
        salvarNoite(user, base.minusHours(26), base.minusHours(18));
        salvarNoite(user, base.minusHours(18), base.minusHours(10));

        assertThat(noitesDoUsuario(user)).isEqualTo(2);
    }

    @Test
    void bancoPermiteMesmoPeriodoEmOutroUsuario() {
        OffsetDateTime base = OffsetDateTime.now();
        User a = usuario("mesmo-periodo-a@example.com");
        User b = usuario("mesmo-periodo-b@example.com");
        salvarNoite(a, base.minusHours(26), base.minusHours(18));
        salvarNoite(b, base.minusHours(26), base.minusHours(18));

        assertThat(noitesDoUsuario(a)).isEqualTo(1);
        assertThat(noitesDoUsuario(b)).isEqualTo(1);
    }

    // ---- quando a corrida acontece, a resposta continua sendo 409 ----

    @Test
    void sobreposicaoQuePassouPelaChecagemVira409() {
        OffsetDateTime base = OffsetDateTime.now();
        User user = usuario("corrida@example.com");
        salvarNoite(user, base.minusHours(26), base.minusHours(18));

        // Simula a corrida: a outra transação gravou depois do SELECT da checagem,
        // então a checagem do serviço não enxerga nada e quem barra é o banco.
        doReturn(List.of()).when(sleepLogRepository)
            .findByUserIdAndSleepStartLessThanAndSleepEndGreaterThan(any(), any(), any());

        CreateSleepLogRequest request = new CreateSleepLogRequest();
        request.setSleepStart(base.minusHours(20));
        request.setSleepEnd(base.minusHours(12));
        request.setQuality((short) 4);

        assertThatThrownBy(() -> sleepService.create(user.getId(), request))
            .isInstanceOf(ResponseStatusException.class)
            .satisfies(e -> assertThat(((ResponseStatusException) e).getStatusCode()).isEqualTo(HttpStatus.CONFLICT));

        assertThat(noitesDoUsuario(user)).isEqualTo(1);
    }

    // ---- apoio ----

    private User usuario(String email) {
        User user = userRepository.save(
            new User(UUID.randomUUID(), email, "hash-de-teste", "Teste", OffsetDateTime.now()));
        usuariosCriados.add(user.getId());
        return user;
    }

    private void salvarNoite(User user, OffsetDateTime inicio, OffsetDateTime fim) {
        sleepLogRepository.saveAndFlush(new SleepLog(UUID.randomUUID(), user, inicio, fim, (short) 4, null));
    }

    /** Conta as noites do usuário (evita count() global, que enxergaria dados de dev). */
    private long noitesDoUsuario(User user) {
        return sleepLogRepository
            .findByUserIdAndSleepStartGreaterThanOrderBySleepStartDesc(user.getId(), OffsetDateTime.now().minusDays(3650))
            .size();
    }
}
