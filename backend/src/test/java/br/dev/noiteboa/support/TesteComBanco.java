package br.dev.noiteboa.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Base dos testes de integração: um PostgreSQL 16 efêmero via Testcontainers.
 *
 * <p>Cada execução da suíte sobe o próprio banco e o descarta no fim; as
 * migrações Flyway rodam nele, então o schema é sempre o do código. Não é mais
 * preciso um Postgres local nem {@code POSTGRES_DB} para rodar {@code mvn
 * verify} — só Docker, que o projeto já usa no {@code docker compose} e na CI
 * (issue #270).</p>
 *
 * <p>O container é um singleton por JVM (padrão do Testcontainers): o Spring
 * reaproveita o contexto entre as classes, então um container por classe
 * deixaria o datasource apontando para um banco já parado. O Ryuk o remove no
 * fim da JVM.</p>
 *
 * <p>Os testes que precisam de banco estendem esta classe; cada um mantém o seu
 * {@code @SpringBootTest} (com as propriedades específicas).</p>
 */
public abstract class TesteComBanco {

    protected static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry propriedades) {
        propriedades.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        propriedades.add("spring.datasource.username", POSTGRES::getUsername);
        propriedades.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
