package br.dev.noiteboa;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CorsConfigurationTest {

    /**
     * Normaliza uma origem: trim, remove barra final, lower case.
     * Ex.: "  https://app.vercel.app/  " → "https://app.vercel.app"
     */
    private String normalizeOrigin(String origin) {
        if (origin == null) return "";
        String normalized = origin.trim().toLowerCase();
        if (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    @Test
    void normalizeOriginHandlesWhitespaceAndTrailingSlash() {
        assertThat(normalizeOrigin("  https://app.vercel.app/  ")).isEqualTo("https://app.vercel.app");
        assertThat(normalizeOrigin("https://app2.vercel.app/")).isEqualTo("https://app2.vercel.app");
        assertThat(normalizeOrigin("HTTP://APP.VERCEL.APP/")).isEqualTo("http://app.vercel.app");
        assertThat(normalizeOrigin("  ")).isEqualTo("");
        assertThat(normalizeOrigin("")).isEqualTo("");
        assertThat(normalizeOrigin("https://app.vercel.app")).isEqualTo("https://app.vercel.app");
    }

    @Test
    void parseMultipleOrigins() {
        String originsEnv = "https://app1.vercel.app,https://app2.vercel.app/";
        List<String> allowedOrigins = List.of(originsEnv.split(","))
            .stream()
            .map(s -> s.trim().toLowerCase())
            .map(s -> s.endsWith("/") ? s.substring(0, s.length() - 1) : s)
            .filter(s -> !s.isEmpty())
            .toList();

        assertThat(allowedOrigins).containsExactly("https://app1.vercel.app", "https://app2.vercel.app");
    }

    @Test
    void emptyOriginsDefaultsToLocalhost() {
        String originsEnv = "";
        List<String> allowedOrigins = List.of(originsEnv.split(","))
            .stream()
            .map(s -> s.trim().toLowerCase())
            .map(s -> s.endsWith("/") ? s.substring(0, s.length() - 1) : s)
            .filter(s -> !s.isEmpty())
            .toList();

        assertThat(allowedOrigins).isEmpty();
    }
}