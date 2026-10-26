package br.dev.noiteboa;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.dev.noiteboa.support.TesteComBanco;
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
class JwtProdSecretTest extends TesteComBanco {

    @Autowired
    private org.springframework.context.ConfigurableApplicationContext context;

    @Autowired
    private JwtService jwtService;

    @Test
    void comVariavelPresenteAProducaoSobeEAssinaToken() {
        assertTrue(context.isActive(), "contexto com perfil prod deveria subir");
        java.util.UUID userId = java.util.UUID.randomUUID();
        String token = jwtService.generateToken(userId);
        assertFalse(token.isBlank(), "JWT_SECRET válida deveria assinar tokens");
        // Não basta não estar em branco (review do PR #282): o token precisa
        // assinar de verdade e carregar o subject esperado — é ele que o filtro
        // usa para resolver a conta.
        assertEquals(userId, jwtService.parseUserId(token));
    }

    @Test
    void comVariavelAusenteAProducaoFalhaNaInicializacao() {
        // --JWT_SECRET= tem precedência máxima (fonte de linha de comando) e
        // simula a variável ausente mesmo em ambiente que a tenha definida.
        // O contexto é montado na mão, então o datasource do container precisa
        // ser passado aqui: sem banco, a falha seria de conexão, não do segredo.
        RuntimeException erro = assertThrows(RuntimeException.class, () ->
            new SpringApplicationBuilder(NoiteBoaApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("prod")
                .run("--JWT_SECRET=",
                    "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                    "--spring.datasource.username=" + POSTGRES.getUsername(),
                    "--spring.datasource.password=" + POSTGRES.getPassword()));

        Throwable raiz = causaRaiz(erro);
        assertTrue(raiz.getMessage() != null && raiz.getMessage().contains("JWT_SECRET"),
            "causa raiz deveria citar JWT_SECRET, mas foi: " + raiz);
    }

    @Test
    void segredoCurtoDerrubaBootEmProd() {
        // 5 bytes: o jjwt até recusaria por conta própria, mas a mensagem precisa
        // dizer o mínimo em bytes para ser acionável (e o JwtService é quem valida).
        RuntimeException erro = assertThrows(RuntimeException.class, () ->
            new SpringApplicationBuilder(NoiteBoaApplication.class)
                .web(WebApplicationType.NONE)
                .profiles("prod")
                .run("--JWT_SECRET=curto",
                    "--spring.datasource.url=" + POSTGRES.getJdbcUrl(),
                    "--spring.datasource.username=" + POSTGRES.getUsername(),
                    "--spring.datasource.password=" + POSTGRES.getPassword()));

        Throwable raiz = causaRaiz(erro);
        assertTrue(raiz.getMessage() != null && raiz.getMessage().contains("32 bytes"),
            "causa raiz deveria citar o mínimo de 32 bytes, mas foi: " + raiz);
    }

    @Test
    void segredoDeDesenvolvimentoERejeitadoComExigenciaAtiva() {
        assertThrows(IllegalStateException.class,
            () -> new JwtService(JwtService.DEV_ONLY_SECRET, 3600, true));
    }

    private static Throwable causaRaiz(Throwable erro) {
        Throwable raiz = erro;
        while (raiz.getCause() != null && raiz.getCause() != raiz) {
            raiz = raiz.getCause();
        }
        return raiz;
    }
}
