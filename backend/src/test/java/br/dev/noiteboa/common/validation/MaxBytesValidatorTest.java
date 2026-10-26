package br.dev.noiteboa.common.validation;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;

class MaxBytesValidatorTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    static class Target {
        @MaxBytes(72)
        String password;

        Target(String password) {
            this.password = password;
        }
    }

    private boolean isValid(String password) {
        return validator.validate(new Target(password)).isEmpty();
    }

    @Test
    void seventyTwoBytesAsciiPasses() {
        assertTrue(isValid("a".repeat(72)));
    }

    @Test
    void seventyThreeBytesAsciiFails() {
        assertFalse(isValid("a".repeat(73)));
    }

    @Test
    void seventyTwoBytesMultibytePasses() {
        // 36 caracteres "á" = 72 bytes em UTF-8 (2 bytes por caractere)
        assertTrue(isValid("á".repeat(36)));
    }

    @Test
    void seventyFourBytesMultibyteFails() {
        // 37 caracteres "á" = 74 bytes: passaria em @Size (37 chars)
        assertFalse(isValid("á".repeat(37)));
    }

    @Test
    void nullPassesToAvoidDuplicatingNotBlankError() {
        assertTrue(isValid(null));
    }

    @Test
    void defaultMessageMentionsTheBytes() {
        String message = validator.validate(new Target("a".repeat(73))).iterator().next().getMessage();
        assertTrue(message.contains("72 bytes"), message);
    }
}
