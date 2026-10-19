package br.dev.noiteboa;

import br.dev.noiteboa.support.TesteComBanco;
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
 * Issue #233 — o {@code SecurityConfig} passou a aceitar PADRÕES de origem
 * ({@code setAllowedOriginPatterns}), porque cada branch de PR na Vercel ganha
 * um domínio novo ({@code https://noite-boa-git-<branch>-<time>.vercel.app}).
 * Com origens exatas, a allowlist precisaria de URL nova a cada PR e o preflight
 * do preview caía em 403 → "NetworkError when attempting to fetch resource".
 *
 * Simula a variável com um padrão curinga e uma origem exata (com barra final,
 * para exercitar a normalização).
 */
@SpringBootTest(properties = "cors.allowed-origins=https://*.vercel.app,https://app.exemplo.com/")
@AutoConfigureMockMvc
class CorsAllowedOriginPatternsTest extends TesteComBanco {

    @Autowired
    MockMvc mockMvc;

    @Test
    void preflightAceitaSubdominioDoPadrao() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "https://noite-boa-git-feat-233-cors-sleep-well.vercel.app")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isOk())
            .andExpect(header().string(
                HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://noite-boa-git-feat-233-cors-sleep-well.vercel.app"))
            .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    void preflightAceitaOutroSubdominioDoPadrao() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "https://noite-boa-git-main-sleep-well.vercel.app")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isOk())
            .andExpect(header().string(
                HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://noite-boa-git-main-sleep-well.vercel.app"));
    }

    @Test
    void preflightAceitaOrigemExataInformadaJuntoComOPadrao() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "https://app.exemplo.com")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isOk())
            .andExpect(header().string(
                HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://app.exemplo.com"));
    }

    @Test
    void preflightRecusaOrigemForaDoPadrao() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "https://app.exemplo.com.br")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isForbidden());
    }
}
