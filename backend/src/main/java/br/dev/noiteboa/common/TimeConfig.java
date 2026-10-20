package br.dev.noiteboa.common;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Relógio do app, injetável (#279). O {@code RateLimiter} usa este bean para
 * decidir a janela deslizante; os testes substituem por um relógio ajustável
 * em vez de dormir.
 */
@Configuration
public class TimeConfig {

    @Bean
    public Clock relogio() {
        return Clock.systemUTC();
    }
}
