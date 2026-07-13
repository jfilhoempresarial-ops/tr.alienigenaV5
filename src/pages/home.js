import { renderCarrosselBanners } from '../components/carrossel-banners.js';

const CATEGORIAS = [
  { id: 'mecanico', label: 'Mecânicos', icone: '🔧' },
  { id: 'posto', label: 'Postos', icone: '⛽' },
  { id: 'borracharia', label: 'Borracharia', icone: '🛞' },
  { id: 'eletrica', label: 'Elétrica', icone: '⚡' },
  { id: 'guincho', label: 'Guincho/Socorro', icone: '🚨' },
  { id: 'pontoapoio', label: 'Pontos de Apoio', icone: '📍' },
  {  id: 'vagas', label: 'Vagas de Emprego', icone: '💼', rotaInterna: '#/vagas' },
  { id: 'fretes', label: 'Fretes', icone: '📦' },
  { id: 'truckfest', label: 'Truck Fest', icone: '🎪', rotaInterna: '#/eventos' },
  { id: 'autopecas', label: 'Auto Peças', icone: '⚙️' },
  { id: 'caminhoes', label: 'Compra e Venda', icone: '🚛', rotaInterna: '#/caminhoes' },
  { id: 'noticias', label: 'Notícias', icone: '📰', rotaInterna: '#/noticias' },
];

export function renderHome(container) {
  container.innerHTML = `
    <section class="home">
      <div id="carrossel-banners"></div>
      <h1>Encontre ajuda na estrada, perto de você</h1>
      <div class="categorias-grid">
        ${CATEGORIAS.map((cat) => {
          const href = cat.externo ?? cat.rotaInterna ?? `#/resultados/${cat.id}`;
          const targetBlank = cat.externo ? 'target="_blank" rel="noopener"' : '';
          return `
          <a href="${href}" ${targetBlank} class="categoria-card">
            <span class="categoria-card__icone">${cat.icone}</span>
            <span class="categoria-card__label">${cat.label}</span>
          </a>
        `;
        }).join('')}
      </div>
    </section>
  `;

  renderCarrosselBanners();
}
