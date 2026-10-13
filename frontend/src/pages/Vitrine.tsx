import { Button, Card, Chip, Field, IconButton, ProgressBar, Ring } from '../components/ui';

/**
 * Vitrine dos componentes base (issue #208) — SÓ em desenvolvimento
 * (`import.meta.env.DEV`; a rota nem existe no build de produção).
 * Mostra todos os componentes e estados para inspeção visual nos dois temas.
 */
export default function Vitrine() {
  return (
    <div style={{ maxWidth: '720px' }}>
      <h1>Vitrine de componentes</h1>
      <p className="overline">Desenvolvimento · tema claro e escuro</p>

      <section aria-label="Button" style={{ marginBottom: '1.5rem' }}>
        <h2>Button</h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Button variant="primary">Primário</Button>
          <Button variant="secondary">Secundário</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="danger">Perigo</Button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <Button size="md" variant="primary">
            Ação principal (48 px)
          </Button>
          <Button size="md" variant="secondary">
            Pílula secundária
          </Button>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button disabled variant="primary">
            Desabilitado
          </Button>
          <Button loading variant="primary">
            Salvando…
          </Button>
          <Button disabled variant="danger">
            Excluir (off)
          </Button>
        </div>
      </section>

      <section aria-label="IconButton" style={{ marginBottom: '1.5rem' }}>
        <h2>IconButton</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <IconButton aria-label="Fechar aviso">✕</IconButton>
          <IconButton aria-label="Reproduzir" disabled>
            ▶
          </IconButton>
          <IconButton aria-label="Mais opções">⋯</IconButton>
        </div>
      </section>

      <section aria-label="Chip" style={{ marginBottom: '1.5rem' }}>
        <h2>Chip</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Chip selected>7 dias</Chip>
          <Chip>30 dias</Chip>
          <Chip disabled>90 dias</Chip>
        </div>
      </section>

      <section aria-label="Field" style={{ marginBottom: '1.5rem' }}>
        <h2>Field</h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <Field label="E-mail" type="email" placeholder="voce@exemplo.com" defaultValue="" />
          <Field label="Senha" type="password" defaultValue="12345678" />
          <Field label="Convite" defaultValue="x" error="Este convite expirou." />
          <Field label="Fuso" defaultValue="America/Sao_Paulo" disabled />
        </div>
      </section>

      <section aria-label="ProgressBar" style={{ marginBottom: '1.5rem' }}>
        <h2>ProgressBar</h2>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ProgressBar value={72} label="Ação/destaque" />
          <ProgressBar value={85} label="Dentro da meta" tone="within" />
          <ProgressBar value={35} label="Abaixo da meta" tone="below" />
        </div>
      </section>

      <section aria-label="Ring" style={{ marginBottom: '1.5rem' }}>
        <h2>Ring</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Ring label="Média de 7 dias: 78% da meta" value={78}>
            <strong className="display-sm">78%</strong>
          </Ring>
          <Ring label="Dentro da meta: 92%" value={92} tone="within">
            <strong className="display-sm">92%</strong>
          </Ring>
          <Ring label="Abaixo da meta: 41%" value={41} tone="below">
            <strong className="display-sm">41%</strong>
          </Ring>
        </div>
      </section>

      <section aria-label="Card" style={{ marginBottom: '1.5rem' }}>
        <h2>Card</h2>
        <Card>
          <p className="overline">Noite de {new Date().toLocaleDateString('pt-BR')}</p>
          <p style={{ margin: '0.5rem 0 0' }}>
            Superfície v2 com tokens <code>--surface</code> nos dois temas.
          </p>
        </Card>
      </section>
    </div>
  );
}
