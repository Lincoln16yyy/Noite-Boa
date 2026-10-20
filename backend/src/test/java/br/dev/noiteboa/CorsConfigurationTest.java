package br.dev.noiteboa;

import br.dev.noiteboa.common.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercita o {@code corsConfigurationSource()} do {@link SecurityConfig} de
 * verdade (#272). Antes, este teste reimplementava a normalização e o fallback,
 * então passava mesmo se a produção mudasse — e afirmava o contrário do
 * fallback real (lista vazia → {@code http://localhost:5173}, não lista vazia).
 *
 * Os outros testes de CORS ({@code CorsAllowedOriginLegacyTest},
 * {@code CorsAllowedOriginsPluralTest}, {@code CorsAllowedOriginPatternsTest})
 * cobrem o preflight de ponta a ponta; este cobre a montagem da lista.
 */
class CorsConfigurationTest {

    /** Monta o {@link CorsConfiguration} de {@code /**} com a propriedade dada. */
    private static CorsConfiguration configurar(String origins) {
        SecurityConfig securityConfig = new SecurityConfig();
        ReflectionTestUtils.setField(securityConfig, "corsAllowedOrigins", origins);

        UrlBasedCorsConfigurationSource source =
            (UrlBasedCorsConfigurationSource) securityConfig.corsConfigurationSource();
        return source.getCorsConfigurations().get("/**");
    }

    @Test
    void normalizaEspacosBarraFinalEMaiusculas() {
        CorsConfiguration config = configurar(
            "  HTTPS://App.Vercel.App/  , https://app2.vercel.app/ , ");

        assertThat(config.getAllowedOriginPatterns())
            .containsExactly("https://app.vercel.app", "https://app2.vercel.app");
    }

    @Test
    void listaVaziaUsaLocalhost() {
        CorsConfiguration config = configurar("  ,  ");

        assertThat(config.getAllowedOriginPatterns())
            .containsExactly("http://localhost:5173");
    }
}
