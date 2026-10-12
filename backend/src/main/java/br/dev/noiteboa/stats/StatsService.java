package br.dev.noiteboa.stats;

import br.dev.noiteboa.auth.User;
import br.dev.noiteboa.auth.UserRepository;
import br.dev.noiteboa.sleep.SleepLog;
import br.dev.noiteboa.sleep.SleepLogRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.TreeMap;

@Service
public class StatsService {

    private static final int TARGET_MINUTES = 8 * 60; // será substituído pela meta na fase #25

    private final SleepLogRepository sleepLogRepository;
    private final UserRepository userRepository;
    private final br.dev.noiteboa.goal.SleepGoalRepository sleepGoalRepository;

    public StatsService(SleepLogRepository sleepLogRepository, UserRepository userRepository,
                        br.dev.noiteboa.goal.SleepGoalRepository sleepGoalRepository) {
        this.sleepLogRepository = sleepLogRepository;
        this.userRepository = userRepository;
        this.sleepGoalRepository = sleepGoalRepository;
    }

    public Summary summary(String email, int days) {
        return doSummary(email, days);
    }

    private Summary doSummary(String email, int days) {
        User user = userRepository.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.UNAUTHORIZED));
        ZoneId zone = ZoneId.of(user.getTimezone() != null ? user.getTimezone() : "America/Sao_Paulo");

        // A janela (agora - days) cobre também a dívida de sono (hoje-6 a
        // ontem), pois days é sempre 7 ou 30 (#98): o limite é aplicado na
        // consulta, sem carregar o histórico inteiro.
        List<SleepLog> logs = sleepLogRepository.findByUserIdAndSleepStartGreaterThanOrderBySleepStartDesc(
                user.getId(), OffsetDateTime.now().minusDays(days));
        
        // agrupar minutos dormidos e horário de dormir por dia local (do início do sono)
        Map<LocalDate, Long> minutesSleptByDate = new TreeMap<>();
        Map<LocalDate, OffsetDateTime> bedtimeByDate = new TreeMap<>();
        for (SleepLog l : logs) {
            LocalDate day = l.getSleepStart().atZoneSameInstant(zone).toLocalDate();
            long minutes = Duration.between(l.getSleepStart(), l.getSleepEnd()).toMinutes();
            minutesSleptByDate.merge(day, minutes, Long::sum);
            bedtimeByDate.putIfAbsent(day, l.getSleepStart());
        }

        double avgHours = logs.isEmpty() ? 0.0 :
            logs.stream()
                .mapToLong(l -> Duration.between(l.getSleepStart(), l.getSleepEnd()).toMinutes())
                .average().orElse(0.0) / 60.0;

        List<Double> bedMinutes = bedtimeByDate.values().stream()
            .map(b -> {
                var ldt = b.atZoneSameInstant(zone);
                int h = ldt.getHour();
                int m = ldt.getMinute();
                double total = h * 60.0 + m;
                // normalizar horários próximos da noite para comparação (depois de 20h ou antes de 6h)
                if (h < 6) total += 24 * 60;
                return total;
            }).toList();

        double consistency = 0.0;
        OptionalDouble mean = bedMinutes.stream().mapToDouble(Double::doubleValue).average();
        if (mean.isPresent()) {
            double m = mean.getAsDouble();
            double variance = bedMinutes.stream().mapToDouble(v -> (v - m) * (v - m)).average().orElse(0.0);
            consistency = Math.sqrt(variance);
        }

        int targetMinutesForDebt = sleepGoalRepository.findById(user.getId())
                .map(br.dev.noiteboa.goal.SleepGoal::getTargetMinutes)
                .orElse(TARGET_MINUTES);
        
        // Calcular dívida de sono:
        // - A janela de cálculo começa no PRIMEIRO registro do usuário no
        //   histórico (ou hoje-6, o que for mais recente) e vai até ontem.
        //   Usar o histórico (não só a janela consultada) evita perdoar os dias
        //   sem registro quando o usuário tem histórico antigo mas parou de
        //   registrar (#161). Consulta barata: data mínima por usuário.
        // - Dias sem registro dentro do intervalo contam como dívida cheia.
        // - Se o usuário nunca registrou nada, dívida é 0 (nada artificial).
        long debtMinutes = 0;
        LocalDate today = LocalDate.now(zone);
        LocalDate yesterday = today.minusDays(1);

        java.util.Optional<OffsetDateTime> primeiroRegistro =
            sleepLogRepository.findFirstSleepStartByUserId(user.getId());
        if (primeiroRegistro.isPresent()) {
            LocalDate firstSleepDate = primeiroRegistro.get().atZoneSameInstant(zone).toLocalDate();

            // Data inicial do intervalo: o mais recente entre (hoje - 6 dias) e a data do primeiro sono
            LocalDate startDate = firstSleepDate.isAfter(today.minusDays(6)) ? firstSleepDate : today.minusDays(6);

            // Calcular dívida para cada dia no intervalo [startDate, yesterday]
            for (LocalDate d = startDate; !d.isAfter(yesterday); d = d.plusDays(1)) {
                long slept = minutesSleptByDate.getOrDefault(d, 0L);
                debtMinutes += Math.max(0, targetMinutesForDebt - slept);
            }
        } // sem nenhum registro no histórico, debtMinutes permanece 0

        List<DayStats> daily = new ArrayList<>();
        for (Map.Entry<LocalDate, Long> e : minutesSleptByDate.entrySet()) {
            OffsetDateTime bed = bedtimeByDate.get(e.getKey());
            daily.add(new DayStats(
                e.getKey().toString(),
                Math.round(e.getValue() / 60.0 * 100.0) / 100.0,
                bed != null ? bed.atZoneSameInstant(zone).toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm")) : null
            ));
        }
        daily.sort(Comparator.comparing(DayStats::getDate));

        return new Summary(days, Math.round(avgHours * 100.0) / 100.0, Math.round(consistency * 100.0) / 100.0, debtMinutes, daily);
    }

    public record Summary(int days, double averageHours, double consistencyMinutes, long sleepDebtMinutes, List<DayStats> daily) {}
    public static class DayStats {
        private final String date;
        private final double hoursSlept;
        private final String bedtime;

        public DayStats(String date, double hoursSlept, String bedtime) {
            this.date = date;
            this.hoursSlept = hoursSlept;
            this.bedtime = bedtime;
        }

        public String getDate() { return date; }
        public double getHoursSlept() { return hoursSlept; }
        public String getBedtime() { return bedtime; }
    }
}