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
        return value == null || value.getBytes(StandardCharsets.UTF_8).length <= max;
    }
}
