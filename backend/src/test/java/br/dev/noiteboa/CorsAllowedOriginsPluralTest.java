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
 * Garante que o nome canônico (plural) de {@code cors.allowed-origins} continua
 * funcionando — comportamento entregue na #105 e preservado pela correção #192.
 */
@SpringBootTest(properties = "cors.allowed-origins=https://novo.vercel.app")
@AutoConfigureMockMvc
class CorsAllowedOriginsPluralTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void preflightAceitaOrigemDaVariavelCanonicaPlural() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                .header(HttpHeaders.ORIGIN, "https://novo.vercel.app")
                .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST"))
            .andExpect(status().isOk())
            .andExpect(header().string(
                HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "https://novo.vercel.app"));
    }
}
