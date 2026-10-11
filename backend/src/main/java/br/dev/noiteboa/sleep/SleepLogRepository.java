package br.dev.noiteboa.sleep;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.UUID;

public interface SleepLogRepository extends JpaRepository<SleepLog, UUID> {

    /**
     * Janela para estatísticas/ranking (#98): só registros a partir de
     * `since` (exclusive), em ordem decrescente do início do sono.
     */
    java.util.List<SleepLog> findByUserIdAndSleepStartGreaterThanOrderBySleepStartDesc(
        UUID userId, OffsetDateTime since);

    @Query("SELECT s FROM SleepLog s WHERE s.user.id = :userId " +
           "AND s.sleepStart >= COALESCE(:from, s.sleepStart) " +
           "AND s.sleepStart <= COALESCE(:to, s.sleepStart) " +
           "ORDER BY s.sleepStart DESC")
    Page<SleepLog> search(@Param("userId") UUID userId,
                          @Param("from") OffsetDateTime from,
                          @Param("to") OffsetDateTime to,
                          Pageable pageable);
}
