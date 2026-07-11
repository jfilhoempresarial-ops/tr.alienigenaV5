const CATEGORIAS = [
  { id: 'mecanico', label: 'Mecânicos', icone: '🔧' },
  { id: 'posto', label: 'Postos', icone: '⛽' },
  { id: 'borracharia', label: 'Borracharia', icone: '🛞' },
  { id: 'eletrica', label: 'Elétrica', icone: '⚡' },
  { id: 'guincho', label: 'Guincho/Socorro', icone: '🚨' },
  { id: 'pontoapoio', label: 'Pontos de Apoio', icone: '📍' },
];

export function renderHome(container) {
  container.innerHTML = `
    <section class="home">
      <h1>Encontre ajuda na estrada, perto de você</h1>
      <div class="categorias-grid">
        ${CATEGORIAS.map(
          (cat) => `
          <a href="#/resultados/${cat.id}" class="categoria-card">
            <span class="categoria-card__icone">${cat.icone}</span>
            <span class="categoria-card__label">${cat.label}</span>
          </a>
        `
        ).join('')}
      </div>
    </section>
  `;
}
