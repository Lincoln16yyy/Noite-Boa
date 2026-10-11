package br.dev.noiteboa.sleep;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.sleep.dto.CreateSleepLogRequest;
import br.dev.noiteboa.sleep.dto.SleepLogResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class SleepService {

    private final SleepLogRepository sleepLogRepository;
    private final UserRepository userRepository;

    /**
     * Limites de sanidade das datas (#99) — constantes fáceis de ajustar.
     * sleepEnd pode ir até 5 min "no futuro" para absorver a latência entre
     * acordar e enviar; sleepStart não pode ser anterior a 1 ano.
     */
    static final Duration MAX_FUTURE_SKEW = Duration.ofMinutes(5);
    static final Duration MAX_AGE = Duration.ofDays(365);

    public SleepService(SleepLogRepository sleepLogRepository, UserRepository userRepository) {
        this.sleepLogRepository = sleepLogRepository;
        this.userRepository = userRepository;
    }

    /** Rejeita datas impossíveis: muito no futuro ou antigas demais (#99). */
    private void validarDatas(OffsetDateTime sleepStart, OffsetDateTime sleepEnd) {
        if (sleepEnd.isAfter(OffsetDateTime.now().plus(MAX_FUTURE_SKEW))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sleepEnd não pode estar no futuro");
        }
        if (sleepStart.isBefore(OffsetDateTime.now().minus(MAX_AGE))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sleepStart não pode ser anterior a 1 ano");
        }
    }

    /**
     * Rejeita com 409 um período que se sobreponha a outro registro do mesmo
     * usuário (#99). Adjacentes (fim == início de outro) são permitidos.
     * Na edição, o próprio registro é ignorado.
     */
    private void assertSemSobreposicao(UUID userId, OffsetDateTime sleepStart, OffsetDateTime sleepEnd, UUID ignorarId) {
        boolean sobrepoe = sleepLogRepository
            .findByUserIdAndSleepStartLessThanAndSleepEndGreaterThan(userId, sleepEnd, sleepStart)
            .stream()
            .anyMatch(l -> ignorarId == null || !l.getId().equals(ignorarId));
        if (sobrepoe) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Este período se sobrepõe a um registro existente.");
        }
    }

    public SleepLogResponse create(String email, CreateSleepLogRequest request) {
        if (request.getSleepEnd().isBefore(request.getSleepStart()) || request.getSleepEnd().isEqual(request.getSleepStart())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fim deve ser após o início");
        }
        Duration duration = Duration.between(request.getSleepStart(), request.getSleepEnd());
        if (duration.toHours() > 24) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Duração máxima é 24h");
        }
        User user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        validarDatas(request.getSleepStart(), request.getSleepEnd());
        assertSemSobreposicao(user.getId(), request.getSleepStart(), request.getSleepEnd(), null);
        SleepLog log = new SleepLog(UUID.randomUUID(), user, request.getSleepStart(), request.getSleepEnd(), request.getQuality(), request.getNotes());
        sleepLogRepository.save(log);
        return new SleepLogResponse(log.getId(), log.getSleepStart(), log.getSleepEnd(), log.getQuality(), log.getNotes());
    }

    public org.springframework.data.domain.Page<SleepLogResponse> list(String email, java.time.OffsetDateTime from, java.time.OffsetDateTime to, int page, int size) {
        br.dev.noiteboa.auth.User user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));
        var pageable = org.springframework.data.domain.PageRequest.of(page, size);
        return sleepLogRepository.search(user.getId(), from, to, pageable)
            .map(s -> new SleepLogResponse(s.getId(), s.getSleepStart(), s.getSleepEnd(), s.getQuality(), s.getNotes()));
    }

    public SleepLogResponse update(String email, java.util.UUID id, br.dev.noiteboa.sleep.dto.CreateSleepLogRequest request) {
        br.dev.noiteboa.auth.User user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));
        var log = sleepLogRepository.findById(id).orElse(null);
        if (log == null || !log.getUser().getId().equals(user.getId())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
        }
        if (request.getSleepEnd().isBefore(request.getSleepStart()) || request.getSleepEnd().isEqual(request.getSleepStart())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Fim deve ser após o início");
        }
        if (java.time.Duration.between(request.getSleepStart(), request.getSleepEnd()).toHours() > 24) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, "Duração máxima é 24h");
        }
        validarDatas(request.getSleepStart(), request.getSleepEnd());
        assertSemSobreposicao(user.getId(), request.getSleepStart(), request.getSleepEnd(), log.getId());
        log.update(request.getSleepStart(), request.getSleepEnd(), request.getQuality(), request.getNotes());
        sleepLogRepository.save(log);
        return new SleepLogResponse(log.getId(), log.getSleepStart(), log.getSleepEnd(), log.getQuality(), log.getNotes());
    }

    public void delete(String email, java.util.UUID id) {
        br.dev.noiteboa.auth.User user = userRepository.findByEmailIgnoreCase(email)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));
        var log = sleepLogRepository.findById(id).orElse(null);
        if (log == null || !log.getUser().getId().equals(user.getId())) {
            throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND);
        }
        sleepLogRepository.delete(log);
    }
}
