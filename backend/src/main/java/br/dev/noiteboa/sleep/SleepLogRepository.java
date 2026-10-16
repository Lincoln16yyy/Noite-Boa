package br.dev.noiteboa.sleep;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
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
     * Média da duração (em horas) das noites do usuário na janela
     * ({@code from}, {@code to}], ou seja, terminando exatamente onde a janela
     * atual começa (#206). {@code null} se não houver nenhuma noite na janela.
     *
     * Os dois limites espelham a janela atual, que é `sleep_start > limite`
     * (findByUserIdAndSleepStartGreaterThan...): assim as janelas atual e
     * anterior particionam o histórico — nenhuma noite cai no vão da borda nem
     * é contada nas duas.
     *
     * Agregado no banco: a comparação de semanas não pode carregar o
     * histórico inteiro para depois médar em Java. Arredonda para 2 casas no
     * servidor, do mesmo jeito que a média atual, para os dois números não
     * divergirem por causa de ponto flutuante.
     *
     * Query nativa porque o JPQL/HQL não tem a duração em segundos entre dois
     * instantes: `EXTRACT(EPOCH FROM fim - inicio)` é do PostgreSQL. O banco do
     * projeto é PostgreSQL desde o M0 (PLANO.md §4), então não há outro dialeto
     * a sustentar aqui.
     */
    @Query(value = "SELECT ROUND(AVG(EXTRACT(EPOCH FROM sleep_end - sleep_start)) / 3600.0, 2) " +
                   "FROM sleep_logs " +
                   "WHERE user_id = :userId AND sleep_start > :from AND sleep_start <= :to",
           nativeQuery = true)
    Optional<BigDecimal> mediaHorasNaJanela(@Param("userId") UUID userId,
                                            @Param("from") OffsetDateTime from,
                                            @Param("to") OffsetDateTime to);

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
