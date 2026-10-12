package br.dev.noiteboa.sleep;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface SleepLogRepository extends JpaRepository<SleepLog, UUID> {

    /**
     * Janela para estatísticas/ranking (#98): só registros a partir de
     * `since` (exclusive), em ordem decrescente do início do sono.
     */
    java.util.List<SleepLog> findByUserIdAndSleepStartGreaterThanOrderBySleepStartDesc(
        UUID userId, OffsetDateTime since);

    /**
     * Início do primeiro registro de sono do usuário (histórico completo).
     * Consulta barata (MIN por usuário) usada pela dívida de sono: a janela de
     * cálculo parte do primeiro registro do usuário, não só dos dentro da
     * janela consultada (#161). Vazio se o usuário nunca registrou.
     */
    @Query("SELECT MIN(s.sleepStart) FROM SleepLog s WHERE s.user.id = :userId")
    Optional<OffsetDateTime> findFirstSleepStartByUserId(@Param("userId") UUID userId);

    /**
     * Candidatos a sobreposição (#99): registros do usuário em que
     * sleepStart &lt; :end AND sleepEnd &gt; :start. Vizinhos (fim == início) não aparecem.
     */
    java.util.List<SleepLog> findByUserIdAndSleepStartLessThanAndSleepEndGreaterThan(
        UUID userId, OffsetDateTime end, OffsetDateTime start);

    @Query("SELECT s FROM SleepLog s WHERE s.user.id = :userId " +
           "AND s.sleepStart >= COALESCE(:from, s.sleepStart) " +
           "AND s.sleepStart <= COALESCE(:to, s.sleepStart) " +
           "ORDER BY s.sleepStart DESC")
    Page<SleepLog> search(@Param("userId") UUID userId,
                          @Param("from") OffsetDateTime from,
                          @Param("to") OffsetDateTime to,
                          Pageable pageable);
}
