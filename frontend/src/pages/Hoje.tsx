import { Link } from 'react-router-dom';

/**
 * Placeholder da rota `/hoje` (issue #209).
 *
 * A aba Hoje é a primeira da navegação v2, mas a tela em si é a issue #210
 * (anel da última noite, hora de dormir, semana em barras). Até lá este stub
 * mantém o destino navegável e leva o usuário para registrar a noite.
 * A issue #210 substitui este arquivo pela tela real.
 */
export default function Hoje() {
  return (
    <section
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        alignItems: 'flex-start',
      }}
    >
      <p className="overline">Hoje</p>
      <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)' }}>
        Sua tela Hoje está chegando
      </h1>
      <p style={{ margin: 0, color: 'var(--text-muted)' }}>
        Enquanto isso, registre como foi a última noite para acompanhar seu sono.
      </p>
      <Link className="btn btn-primary" to="/registrar">
        Registrar noite
      </Link>
    </section>
  );
}
