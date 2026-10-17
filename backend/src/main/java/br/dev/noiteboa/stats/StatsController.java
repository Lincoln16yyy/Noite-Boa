package br.dev.noiteboa.stats;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.security.core.Authentication;

@RestController
public class StatsController {

    private final StatsService statsService;

    public StatsController(StatsService statsService) {
        this.statsService = statsService;
    }

    @GetMapping("/api/stats/summary")
    public StatsService.Summary summary(Authentication authentication,
                                        @RequestParam(defaultValue = "7") int days) {
        if (days != 7 && days != 30) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "days deve ser 7 ou 30");
        }
        java.util.UUID userId = (java.util.UUID) authentication.getPrincipal();
        return statsService.summary(userId, days);
    }
}
