package br.dev.noiteboa.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

import java.nio.charset.StandardCharsets;

public class MaxBytesValidator implements ConstraintValidator<MaxBytes, String> {

    private int max;

    @Override
    public void initialize(MaxBytes annotation) {
        this.max = annotation.value();
    }

    @Override
    public boolean isValid(String value, ConstraintValidatorContext context) {
        // null é responsabilidade do @NotBlank; aqui só medimos o que existe
        if (value == null) {
            return true;
        }
        // Toda string com mais de `max` unidades UTF-16 tem mais de `max` bytes
        // em UTF-8 (uma unidade vira de 1 a 4 bytes). Cortar aqui evita alocar
        // um array do tamanho de uma senha gigante vinda de fora (review #340).
        if (value.length() > max) {
            return false;
        }
        return value.getBytes(StandardCharsets.UTF_8).length <= max;
    }
}
