-- Issue #265: a checagem de sobreposição (#99) vive no serviço — ela faz um
-- SELECT e só depois o INSERT. Duas transações simultâneas passam pela checagem
-- e gravam as duas noites sobrepostas. O banco passa a ser a última linha de
-- defesa; a aplicação continua rejeitando antes, com mensagem amigável.

-- btree_gist fornece o operador "=" de uuid em índice GiST. O schema é explícito
-- para a extensão não cair no primeiro schema do search_path da conexão.
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- `IF NOT EXISTS` não relocaliza uma instalação que já exista em outro schema
-- (o schema de teste deixado pelo FlywayMigrationTest, por exemplo): a constraint
-- passaria a depender de objetos de lá e um DROP SCHEMA ... CASCADE levaria a
-- constraint junto — em silêncio, porque a V5 continuaria marcada como aplicada.
-- Mover a extensão para junto da tabela resolve os dois casos (review do PR #281).
DO $$
DECLARE schema_da_extensao text;
BEGIN
    SELECT n.nspname INTO schema_da_extensao
      FROM pg_extension e
      JOIN pg_namespace n ON n.oid = e.extnamespace
     WHERE e.extname = 'btree_gist';

    IF schema_da_extensao IS NOT NULL AND schema_da_extensao <> 'public' THEN
        EXECUTE 'ALTER EXTENSION btree_gist SET SCHEMA public';
    END IF;
END $$;

-- A constraint valida as linhas que já existem: se a corrida antiga deixou
-- noites sobrepostas, o ALTER TABLE abaixo falharia com "conflicting key value"
-- e o serviço não subiria. Aqui a falha vem com os usuários afetados, e nenhum
-- dado é apagado por conta da migração — quem decide o que fazer com as noites
-- é quem opera (review do PR #281).
DO $$
DECLARE usuarios_afetados text;
BEGIN
    SELECT string_agg(DISTINCT a.user_id::text, ', ')
      INTO usuarios_afetados
      FROM sleep_logs a
      JOIN sleep_logs b
        ON a.user_id = b.user_id
       AND a.id < b.id
       AND tstzrange(a.sleep_start, a.sleep_end) && tstzrange(b.sleep_start, b.sleep_end);

    IF usuarios_afetados IS NOT NULL THEN
        RAISE EXCEPTION 'V5 nao pode ser aplicada: existem noites sobrepostas para os usuarios %', usuarios_afetados
            USING HINT = 'Reconcilie ou remova as noites sobrepostas desses usuarios e rode a migracao de novo.';
    END IF;
END $$;

-- tstzrange com os limites padrão, [início, fim): "fim == início de outro"
-- continua permitido, que é a regra que a API sempre prometeu (#99).
--
-- O ADD CONSTRAINT monta e valida o índice GiST sob lock exclusivo da tabela;
-- hoje sleep_logs é pequena/vazia, então é instantâneo. Num banco com milhões de
-- linhas isso pediria janela de manutenção.
ALTER TABLE sleep_logs
    ADD CONSTRAINT ex_sleep_logs_sem_sobreposicao
    EXCLUDE USING gist (user_id WITH =, tstzrange(sleep_start, sleep_end) WITH &&);
