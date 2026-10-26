package br.dev.noiteboa.common.validation;

import jakarta.validation.Constraint;
import jakarta.validation.Payload;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Limita o tamanho em <strong>bytes UTF-8</strong>, não em caracteres.
 *
 * <p>O BCrypt considera só os primeiros 72 bytes da senha; sem esta validação,
 * uma senha maior seria truncada silenciosamente e o excesso nunca verificado
 * (issue #323). {@code @Size} conta caracteres (UTF-16), então um texto com
 * acentos ou emoji pode passar no {@code @Size} e ainda estourar os 72 bytes.</p>
 */
@Documented
@Constraint(validatedBy = MaxBytesValidator.class)
@Target({ElementType.FIELD, ElementType.PARAMETER, ElementType.RECORD_COMPONENT})
@Retention(RetentionPolicy.RUNTIME)
public @interface MaxBytes {

    int value();

    String message() default "deve ter no máximo {value} bytes";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};
}
