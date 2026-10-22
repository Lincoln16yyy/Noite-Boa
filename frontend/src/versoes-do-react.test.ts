import react from 'react/package.json';
import reactDom from 'react-dom/package.json';

describe('versões do React', () => {
  it('react e react-dom têm exatamente a mesma versão (#311)', () => {
    // O React aborta a renderização ("Incompatible React versions") quando as
    // duas versões divergem — e, sem esta checagem, o sintoma é o app inteiro
    // não subir e dezenas de testes falharem sem apontar a causa. Manter os
    // dois pinados no package.json evita o desvio; este teste avisa cedo se
    // alguém (ou um bot) subir só um deles.
    expect(reactDom.version).toBe(react.version);
  });
});
