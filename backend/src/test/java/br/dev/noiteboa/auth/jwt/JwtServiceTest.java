package br.dev.noiteboa.auth.jwt;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Regras do segredo JWT que não dependem de banco (issue #323). O boot com o
 * perfil prod continua coberto por {@code JwtProdSecretTest}, que usa
 * Testcontainers.
 */
class JwtServiceTest {

    @Test
    void secretShorterThan32BytesFailsWithClearMessage() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
            () -> new JwtService("curto", 3600, false));

        assertTrue(error.getMessage() != null && error.getMessage().contains("32 bytes"),
            "mensagem deveria citar o mínimo de 32 bytes, mas foi: " + error.getMessage());
    }

    @Test
    void secretWith32BytesIsTheMinimumAccepted() {
        // 256 bits é o mínimo do HMAC-SHA256 usado pelo jjwt
        assertDoesNotThrow(() -> new JwtService("a".repeat(32), 3600, false));
    }
}
