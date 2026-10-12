import { Link, useSearchParams } from 'react-router-dom';
import styles from './Home.module.css';

const STEPS = [
  {
    title: 'Registre sua noite',
    text: 'Diga quando foi dormir e acordar e como você sentiu o sono. Leva menos de um minuto.',
  },
  {
    title: 'Entenda seu padrão',
    text: 'Veja média de horas, consistência e dívida de sono, com o gráfico da semana e a sua meta em destaque.',
  },
  {
    title: 'Ajuste sua meta',
    text: 'Defina quantas horas quer dormir e seus horários de referência. O app acompanha a evolução no tempo.',
  },
];

export default function Home() {
  const [searchParams] = useSearchParams();
  const contaExcluida = searchParams.get('deleted') === 'true';

  return (
    <div className={styles.page}>
      {contaExcluida && (
        <p role="status" className={styles.notice}>
          Sua conta foi excluída. Seus registros, metas e amizades foram apagados — pode criar
          uma nova conta quando quiser.
        </p>
      )}
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.brand}>
          <img src="/mark-light.svg" alt="" className={styles.mark} />
          <span className={styles.name}>Noite Boa</span>
        </div>

        <h1 id="hero-title" className={styles.tagline}>
          Durma melhor, no seu ritmo.
        </h1>
        <p className={styles.lead}>
          Um diário de sono simples para registrar suas noites, entender o padrão e criar
          consistência de horários — sem culpa, no seu ritmo.
        </p>

        <div className={styles.actions}>
          <Link to="/cadastro" className={styles.btnPrimary}>
            Criar conta grátis
          </Link>
          <Link to="/login" className={styles.btnGhost}>
            Já tenho conta
          </Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="como-funciona-title">
        <h2 id="como-funciona-title" className={styles.sectionTitle}>
          Como funciona
        </h2>
        <p className={styles.sectionLead}>Três passos para cuidar do seu sono.</p>

        <ol className={styles.grid}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.card}>
              <span className={styles.badge} aria-hidden="true">
                {index + 1}
              </span>
              <h3 className={styles.cardTitle}>{step.title}</h3>
              <p className={styles.cardText}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.cta} aria-labelledby="cta-title">
        <h2 id="cta-title" className={styles.ctaTitle}>
          Pronto para dormir melhor?
        </h2>
        <p className={styles.ctaText}>Criar a sua conta é grátis e leva menos de um minuto.</p>

        <div className={styles.actions}>
          <Link to="/cadastro" className={styles.btnPrimary}>
            Criar conta
          </Link>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Noite Boa · Durma melhor, no seu ritmo.</p>
      </footer>
    </div>
  );
}
