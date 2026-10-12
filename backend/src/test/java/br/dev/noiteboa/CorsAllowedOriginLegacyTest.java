package br.dev.noiteboa;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regressão #192 — o {@code SecurityConfig} lê {@code cors.allowed-origins}
 * (plural), mas a Render e a documentação definiam {@code CORS_ALLOWED_ORIGIN}
 * (singular), que o Spring associa a {@code cors.allowed-origin}. Em produção a
 * lista caía no default e o preflight do front da Vercel era recusado (403 →
 * "NetworkError" no navegador).
 *
 * Este teste simula a variável legada (singular) e garante que a origem dela é
 * aceita no preflight. Falhava antes da correção.
 */
@SpringBootTest(properties = "cors.allowed-origin=https://legado.vercel.app")
@AutoConfigureMockMvc
class CorsAllowedOriginLegacyTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void preflightAceitaOrigemDaVariavelLegadaSingular() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "https://legado.vercel.app")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isOk())
            .andExpect(header().string(
                HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://legado.vercel.app"));
    }
}
