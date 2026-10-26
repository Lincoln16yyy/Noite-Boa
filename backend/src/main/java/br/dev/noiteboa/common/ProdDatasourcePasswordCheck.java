package br.dev.noiteboa.common;

import org.springframework.beans.factory.config.BeanFactoryPostProcessor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

/**
 * Recusa a senha de desenvolvimento do banco quando o perfil {@code prod} está
 * ativo.
 *
 * <p>O {@code application.yml} usa {@code sono_dev_only} como default local; em
 * produção a senha vem de {@code SPRING_DATASOURCE_PASSWORD} (Neon). Se a
 * variável não for definida — ou for copiada do compose — a aplicação subiria
 * apontando para o banco errado, ou falharia só na primeira conexão com um erro
 * de autenticação pouco claro. Este {@link BeanFactoryPostProcessor} roda antes
 * de qualquer singleton (inclusive o Flyway) e derruba o boot com uma mensagem
 * acionável (issue #323).</p>
 */
@Configuration
public class ProdDatasourcePasswordCheck {

    static final String DEV_PASSWORD = "sono_dev_only";

    @Bean
    static BeanFactoryPostProcessor rejectDevDatasourcePassword(Environment environment) {
        return beanFactory -> validate(environment);
    }

    static void validate(Environment environment) {
        if (!environment.matchesProfiles("prod")) {
            return;
        }
        String password = environment.getProperty("spring.datasource.password");
        if (password == null || password.isBlank()) {
            throw new IllegalStateException(
                "Senha do banco não configurada (perfil prod): defina a variável de ambiente "
                + "SPRING_DATASOURCE_PASSWORD com a senha do banco de produção.");
        }
        if (DEV_PASSWORD.equals(password)) {
            throw new IllegalStateException(
                "A senha de desenvolvimento do banco (sono_dev_only) não é aceita em produção: "
                + "defina SPRING_DATASOURCE_PASSWORD com a senha do banco de produção (Neon).");
        }
    }
}
