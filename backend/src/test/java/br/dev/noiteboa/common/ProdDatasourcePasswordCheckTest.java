package br.dev.noiteboa.common;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.dev.noiteboa.NoiteBoaApplication;
import org.junit.jupiter.api.Test;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.mock.env.MockEnvironment;

class ProdDatasourcePasswordCheckTest {

    private static MockEnvironment prodWith(String password) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        if (password != null) {
            environment.setProperty("spring.datasource.password", password);
        }
        return environment;
    }

    @Test
    void devPasswordFailsInProd() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
            () -> ProdDatasourcePasswordCheck.validate(prodWith("sono_dev_only")));

        assertTrue(error.getMessage().contains("SPRING_DATASOURCE_PASSWORD"), error.getMessage());
    }

    @Test
    void missingPasswordFailsInProd() {
        IllegalStateException error = assertThrows(IllegalStateException.class,
            () -> ProdDatasourcePasswordCheck.validate(prodWith(null)));

        assertTrue(error.getMessage().contains("SPRING_DATASOURCE_PASSWORD"), error.getMessage());
    }

    @Test
    void strongPasswordPassesInProd() {
        assertDoesNotThrow(() -> ProdDatasourcePasswordCheck.validate(prodWith("senha-do-neon")));
    }

    @Test
    void devPasswordPassesOutsideProd() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("dev");
        environment.setProperty("spring.datasource.password", "sono_dev_only");

        assertDoesNotThrow(() -> ProdDatasourcePasswordCheck.validate(environment));
    }

    @Test
    void devPasswordFailsBootInProd() {
        // O post-processor roda antes do Flyway/DataSource: não é preciso banco
        // para provar que o boot para com a mensagem certa.
        RuntimeException error = assertThrows(RuntimeException.class, () ->
            new SpringApplicationBuilder(NoiteBoaApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("prod")
                .run("--JWT_SECRET=" + "a".repeat(48),
                    "--spring.datasource.password=sono_dev_only"));

        Throwable rootCause = error;
        while (rootCause.getCause() != null && rootCause.getCause() != rootCause) {
            rootCause = rootCause.getCause();
        }
        assertTrue(rootCause.getMessage() != null && rootCause.getMessage().contains("SPRING_DATASOURCE_PASSWORD"),
            "causa raiz deveria citar SPRING_DATASOURCE_PASSWORD, mas foi: " + rootCause);
    }
}
