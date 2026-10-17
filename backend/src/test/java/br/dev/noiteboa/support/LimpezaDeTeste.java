package br.dev.noiteboa.support;

import br.dev.noiteboa.auth.UserRepository;

/**
 * Limpeza padrão da suíte: remove <b>somente</b> dados de teste do banco.
 *
 * <p>O marcador é o domínio {@code @example.com} (reservado pela RFC 2606, que
 * nenhuma pessoa real usa). Apagar globalmente com {@code deleteAll()} é
 * proibido aqui: a suíte roda no mesmo PostgreSQL do {@code spring-boot:run} e
 * levaria junto os dados reais do desenvolvedor (#269).</p>
 *
 * <p>As chaves estrangeiras de {@code sleep_logs}, {@code sleep_goals} e
 * {@code friendships} têm {@code ON DELETE CASCADE}, então remover a conta de
 * teste já apaga os dados filhos dela.</p>
 */
public final class LimpezaDeTeste {

    /** Domínio reservado para dados de teste (RFC 2606). */
    public static final String SUFIXO_DE_TESTE = "@example.com";

    private LimpezaDeTeste() {
    }

    /** Remove as contas de teste; o cascade das FKs cuida dos dados ligados a elas. */
    public static void limpar(UserRepository usuarios) {
        usuarios.findAll().stream()
            .filter(u -> u.getEmail() != null
                && u.getEmail().toLowerCase(java.util.Locale.ROOT).endsWith(SUFIXO_DE_TESTE))
            .forEach(usuarios::delete);
    }
}
