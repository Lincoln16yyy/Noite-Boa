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

    private static MockEnvironment prodCom(String senha) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        if (senha != null) {
            environment.setProperty("spring.datasource.password", senha);
        }
        return environment;
    }

    @Test
    void senhaDeDesenvolvimentoFalhaEmProd() {
        IllegalStateException erro = assertThrows(IllegalStateException.class,
            () -> ProdDatasourcePasswordCheck.validate(prodCom("sono_dev_only")));

        assertTrue(erro.getMessage().contains("SPRING_DATASOURCE_PASSWORD"), erro.getMessage());
    }

    @Test
    void senhaAusenteFalhaEmProd() {
        IllegalStateException erro = assertThrows(IllegalStateException.class,
            () -> ProdDatasourcePasswordCheck.validate(prodCom(null)));

        assertTrue(erro.getMessage().contains("SPRING_DATASOURCE_PASSWORD"), erro.getMessage());
    }

    @Test
    void senhaFortePassaEmProd() {
        assertDoesNotThrow(() -> ProdDatasourcePasswordCheck.validate(prodCom("senha-do-neon")));
    }

    @Test
    void senhaDeDesenvolvimentoPassaForaDeProd() {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("dev");
        environment.setProperty("spring.datasource.password", "sono_dev_only");

        assertDoesNotThrow(() -> ProdDatasourcePasswordCheck.validate(environment));
    }

    @Test
    void senhaDeDesenvolvimentoDerrubaBootEmProd() {
        // O post-processor roda antes do Flyway/DataSource: não é preciso banco
        // para provar que o boot para com a mensagem certa.
        RuntimeException erro = assertThrows(RuntimeException.class, () ->
            new SpringApplicationBuilder(NoiteBoaApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("prod")
                .run("--JWT_SECRET=" + "a".repeat(48),
                    "--spring.datasource.password=sono_dev_only"));

        Throwable raiz = erro;
        while (raiz.getCause() != null && raiz.getCause() != raiz) {
            raiz = raiz.getCause();
        }
        assertTrue(raiz.getMessage() != null && raiz.getMessage().contains("SPRING_DATASOURCE_PASSWORD"),
            "causa raiz deveria citar SPRING_DATASOURCE_PASSWORD, mas foi: " + raiz);
    }
}
