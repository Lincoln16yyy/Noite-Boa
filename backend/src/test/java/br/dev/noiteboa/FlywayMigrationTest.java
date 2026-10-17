package br.dev.noiteboa;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;

/**
 * Valida que a migração Flyway roda em um banco limpo.
 * Requer um Postgres acessível (ver docker-compose.yml).
 */
class FlywayMigrationTest {

    private static final String SCHEMA = "flyway_test";

    /**
     * Mesmas variáveis do application.yml: assim a suíte não toca o banco de dev
     * quando `POSTGRES_DB` está setado (#269; review do PR #284). Sem as variáveis
     * o padrão continua `sono`, como no CI.
     */
    private static String url() {
        return "jdbc:postgresql://" + env("DB_HOST", "localhost") + ":" + env("DB_PORT", "5432")
            + "/" + env("POSTGRES_DB", "sono");
    }

    private static String usuario() {
        return env("POSTGRES_USER", "sono");
    }

    private static String senha() {
        return env("POSTGRES_PASSWORD", "sono_dev_only");
    }

    private static String env(String chave, String padrao) {
        String valor = System.getenv(chave);
        return valor == null || valor.isBlank() ? padrao : valor;
    }

    @Test
    void migrationV1AppliesOnCleanDatabase() throws SQLException {
        try (Connection c = DriverManager.getConnection(url(), usuario(), senha());
             Statement s = c.createStatement()) {
            s.execute("DROP SCHEMA IF EXISTS " + SCHEMA + " CASCADE");
            s.execute("CREATE SCHEMA " + SCHEMA);
        }

        Flyway flyway = Flyway.configure()
            .dataSource(url(), usuario(), senha())
            .schemas(SCHEMA)
            .load();
        flyway.migrate();

        assertEquals("5", flyway.info().current().getVersion().toString());

        try (Connection c = DriverManager.getConnection(url(), usuario(), senha());
             Statement s = c.createStatement()) {
            s.execute("SET search_path TO " + SCHEMA);
            s.execute("INSERT INTO users (email, password_hash, display_name) VALUES ('a@b.com','x','A')");
            try {
                s.execute("INSERT INTO users (email, password_hash, display_name) VALUES ('A@B.com','x','B')");
                throw new AssertionError("esperava violação de email único case-insensitive");
            } catch (SQLException expected) {
                // OK: e-mail duplicado ignorando caso deve falhar
            }

            s.execute("INSERT INTO sleep_logs (user_id, sleep_start, sleep_end, quality) " +
                      "SELECT id, '2026-10-01 22:00:00+00', '2026-10-02 06:00:00+00', 4 FROM users LIMIT 1");

            assertInsertFails(s, "INSERT INTO sleep_logs (user_id, sleep_start, sleep_end, quality) " +
                "SELECT id, '2026-10-02 06:00:00+00', '2026-10-01 22:00:00+00', 4 FROM users LIMIT 1");
            assertInsertFails(s, "INSERT INTO sleep_logs (user_id, sleep_start, sleep_end, quality) " +
                "SELECT id, '2026-10-01 22:00:00+00', '2026-10-02 06:00:00+00', 7 FROM users LIMIT 1");

            // V5: o banco recusa noites sobrepostas do mesmo usuário. A checagem do
            // serviço é SELECT+INSERT, então duas transações simultâneas passariam por
            // ela — a constraint é a última linha de defesa (#265).
            assertInsertFails(s, "INSERT INTO sleep_logs (user_id, sleep_start, sleep_end, quality) " +
                "SELECT id, '2026-10-01 23:00:00+00', '2026-10-02 07:00:00+00', 4 FROM users WHERE email = 'a@b.com'");

            // Adjacente continua permitido (fim == início de outro)
            s.execute("INSERT INTO sleep_logs (user_id, sleep_start, sleep_end, quality) " +
                "SELECT id, '2026-10-02 06:00:00+00', '2026-10-02 08:00:00+00', 4 FROM users WHERE email = 'a@b.com'");

            // V4: amizade — consentimento duplo com par único, pessoas distintas e status válidos
            s.execute("INSERT INTO users (email, password_hash, display_name) VALUES ('c@d.com','x','C')");
            s.execute("INSERT INTO friendships (id, requester_id, addressee_id, status) " +
                      "SELECT gen_random_uuid(), a.id, b.id, 'PENDING' FROM users a, users b " +
                      "WHERE a.email = 'a@b.com' AND b.email = 'c@d.com'");
            assertInsertFails(s, "INSERT INTO friendships (id, requester_id, addressee_id) " +
                "SELECT gen_random_uuid(), a.id, b.id FROM users a, users b " +
                "WHERE a.email = 'a@b.com' AND b.email = 'c@d.com'");
            assertInsertFails(s, "INSERT INTO friendships (id, requester_id, addressee_id, status) " +
                "SELECT gen_random_uuid(), a.id, b.id, 'conhecidos' FROM users a, users b " +
                "WHERE a.email = 'a@b.com' AND b.email = 'c@d.com'");
            assertInsertFails(s, "INSERT INTO friendships (id, requester_id, addressee_id) " +
                "SELECT gen_random_uuid(), a.id, a.id FROM users a LIMIT 1");

            // otimista: share_with_friends nasce desligado (privacidade primeiro)
            try (var rs = s.executeQuery("SELECT share_with_friends FROM users LIMIT 1")) {
                if (rs.next() && rs.getBoolean(1)) {
                    throw new AssertionError("share_with_friends deveria começar false");
                }
            }
        }
    }

    private void assertInsertFails(Statement s, String sql) throws SQLException {
        try {
            s.execute(sql);
            throw new AssertionError("esperava violação de constraint");
        } catch (SQLException expected) {
            // OK
        }
    }
}
