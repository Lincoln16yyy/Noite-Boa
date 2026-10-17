package br.dev.noiteboa;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.dev.noiteboa.auth.jwt.JwtService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.test.context.ActiveProfiles;

/**
 * Exige JWT_SECRET em produção (perfil prod liga JWT_SECRET_REQUIRED).
 *
 * Cenários: variável presente → a aplicação sobe e assina tokens;
 * variável ausente → falha na inicialização com mensagem citando JWT_SECRET;
 * e o valor de desenvolvimento nunca é aceito com a exigência ligada.
 *
 * O valor usado nos testes é um literal de teste, não um segredo real.
 */
@SpringBootTest(
    properties = "JWT_SECRET=nao-e-segredo-real-de-teste-0123456789abcdef0123456789abcdef")
@ActiveProfiles("prod")
class JwtProdSecretTest {

    @Autowired
    private org.springframework.context.ConfigurableApplicationContext context;

    @Autowired
    private JwtService jwtService;

    @Test
    void comVariavelPresenteAProducaoSobeEAssinaToken() {
        assertTrue(context.isActive(), "contexto com perfil prod deveria subir");
        String token = jwtService.generateToken(java.util.UUID.randomUUID());
        assertFalse(token.isBlank(), "JWT_SECRET válida deveria assinar tokens");
    }

    @Test
    void comVariavelAusenteAProducaoFalhaNaInicializacao() {
        // --JWT_SECRET= tem precedência máxima (fonte de linha de comando) e
        // simula a variável ausente mesmo em ambiente que a tenha definida.
        RuntimeException erro = assertThrows(RuntimeException.class, () ->
            new SpringApplicationBuilder(NoiteBoaApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("prod")
                .run("--JWT_SECRET="));

        Throwable raiz = erro;
        while (raiz.getCause() != null && raiz.getCause() != raiz) {
            raiz = raiz.getCause();
        }
        assertTrue(raiz.getMessage() != null && raiz.getMessage().contains("JWT_SECRET"),
            "causa raiz deveria citar JWT_SECRET, mas foi: " + raiz);
    }

    @Test
    void segredoDeDesenvolvimentoERejeitadoComExigenciaAtiva() {
        assertThrows(IllegalStateException.class,
            () -> new JwtService(JwtService.DEV_ONLY_SECRET, 3600, true));
    }
}
