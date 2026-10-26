package br.dev.noiteboa.common.validation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class MaxBytesValidatorTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    static class Alvo {
        @MaxBytes(72)
        String senha;

        Alvo(String senha) {
            this.senha = senha;
        }
    }

    private boolean valido(String senha) {
        return validator.validate(new Alvo(senha)).isEmpty();
    }

    @Test
    void setentaEDoisBytesAsciiPassa() {
        assertTrue(valido("a".repeat(72)));
    }

    @Test
    void setentaETresBytesAsciiFalha() {
        assertFalse(valido("a".repeat(73)));
    }

    @Test
    void setentaEDoisBytesMultibytePassa() {
        // 36 caracteres "á" = 72 bytes em UTF-8 (2 bytes por caractere)
        assertTrue(valido("á".repeat(36)));
    }

    @Test
    void setentaEQuatroBytesMultibyteFalha() {
        // 37 caracteres "á" = 74 bytes: passaria em @Size (37 chars)
        assertFalse(valido("á".repeat(37)));
    }

    @Test
    void nuloPassaParaNaoDuplicarOErroDoNotBlank() {
        assertTrue(valido(null));
    }

    @Test
    void mensagemPadraoCitaOsBytes() {
        String mensagem = validator.validate(new Alvo("a".repeat(73))).iterator().next().getMessage();
        assertTrue(mensagem.contains("72 bytes"), mensagem);
    }
}
