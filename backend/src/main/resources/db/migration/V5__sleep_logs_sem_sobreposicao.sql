-- Issue #265: a checagem de sobreposição (#99) vive no serviço — ela faz um
-- SELECT e só depois o INSERT. Duas transações simultâneas passam pela checagem
-- e gravam as duas noites sobrepostas. O banco passa a ser a última linha de
-- defesa; a aplicação continua rejeitando antes, com mensagem amigável.
--
-- btree_gist fornece o operador "=" de uuid em índice GiST. O schema é
-- explícito de propósito: sem ele a extensão vai para o primeiro schema do
-- search_path da conexão (o schema de teste do FlywayMigrationTest, por
-- exemplo) e um DROP SCHEMA ... CASCADE levaria a constraint junto — em
-- silêncio, já que a V5 continuaria marcada como aplicada (#269 deixa esse
-- schema no banco).
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

-- tstzrange com os limites padrão, [início, fim): "fim == início de outro"
-- continua permitido, que é a regra que a API sempre prometeu (#99).
ALTER TABLE sleep_logs
    ADD CONSTRAINT ex_sleep_logs_sem_sobreposicao
    EXCLUDE USING gist (user_id WITH =, tstzrange(sleep_start, sleep_end) WITH &&);
