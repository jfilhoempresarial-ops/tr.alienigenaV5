import { renderCarrosselBanners } from '../components/carrossel-banners.js';
import { buscarEmpresasDestaque } from '../services/empresas.service.js';
import { buscarVagas } from '../services/vagas.service.js';
import { buscarFretesDestaque } from '../services/fretes.service.js';

const CATEGORIAS = [
  { id: 'mecanico', label: 'Mecânicos', icone: '🔧' },
  { id: 'posto', label: 'Postos', icone: '⛽' },
  { id: 'borracharia', label: 'Borracharia', icone: '🛞' },
  { id: 'eletrica', label: 'Elétrica', icone: '⚡' },
  { id: 'guincho', label: 'Guincho/Socorro', icone: '🚨' },
  { id: 'pontoapoio', label: 'Pontos de Apoio', icone: '📍' },
  { id: 'vagas', label: 'Vagas de Emprego', icone: '💼', rotaInterna: '#/vagas' },
  { id: 'fretes', label: 'Fretes', icone: '📦' },
  { id: 'truckfest', label: 'Truck Fest', icone: '🎪', rotaInterna: '#/eventos' },
  { id: 'autopecas', label: 'Auto Peças', icone: '⚙️' },
  { id: 'caminhoes', label: 'Compra e Venda', icone: '🚛', rotaInterna: '#/caminhoes' },
  { id: 'noticias', label: 'Notícias', icone: '📰', rotaInterna: '#/noticias' },
];

const LABEL_POR_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label]));

export function renderHome(container) {
  container.innerHTML = `
    <section class="home">
      <div id="carrossel-banners"></div>
      <h1>Encontre ajuda na estrada, perto de você</h1>

      <div class="categorias-carrossel">
        <button class="categorias-carrossel__seta categorias-carrossel__seta--esquerda" aria-label="Categorias anteriores">‹</button>
        <div class="categorias-carrossel__trilho" id="categorias-trilho">
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
        <button class="categorias-carrossel__seta categorias-carrossel__seta--direita" aria-label="Próximas categorias">›</button>
      </div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">📍 Perto de você agora</h2>
        </div>
        <div class="home-secao__lista" id="lista-perto-de-voce">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">💼 Vagas em destaque</h2>
          <a href="#/vagas" class="home-secao__ver-todas">Ver todas</a>
        </div>
        <div class="home-secao__lista" id="lista-vagas">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">📦 Fretes disponíveis</h2>
          <span class="home-secao__ver-todas home-secao__ver-todas--em-breve">Em breve</span>
        </div>
        <div class="home-secao__lista" id="lista-fretes">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>
    </section>
  `;

  renderCarrosselBanners();
  configurarCarrosselCategorias(container);
  carregarPertoDeVoce(container);
  carregarVagasDestaque(container);
  carregarFretesDestaque(container);
}

function configurarCarrosselCategorias(container) {
  const trilho = container.querySelector('#categorias-trilho');
  const setaEsquerda = container.querySelector('.categorias-carrossel__seta--esquerda');
  const setaDireita = container.querySelector('.categorias-carrossel__seta--direita');
  const distanciaScroll = () => trilho.clientWidth * 0.7;

  setaEsquerda.addEventListener('click', () => {
    trilho.scrollBy({ left: -distanciaScroll(), behavior: 'smooth' });
  });
  setaDireita.addEventListener('click', () => {
    trilho.scrollBy({ left: distanciaScroll(), behavior: 'smooth' });
  });
}

async function carregarPertoDeVoce(container) {
  const alvo = container.querySelector('#lista-perto-de-voce');
  try {
    const empresas = await buscarEmpresasDestaque(6);
    if (empresas.length === 0) {
      alvo.innerHTML = `<p class="home-secao__vazio">Nenhuma empresa cadastrada ainda.</p>`;
      return;
    }
    alvo.innerHTML = empresas.map(renderMiniCardEmpresa).join('');
  } catch (erro) {
    alvo.innerHTML = `<p class="home-secao__vazio">Não foi possível carregar agora.</p>`;
    console.error(erro);
  }
}

function renderMiniCardEmpresa(empresa) {
  const tel = (empresa.whatsapp || '').replace(/\D/g, '');
  const categoria = (empresa.categorias || [])[0];
  const label = LABEL_POR_CATEGORIA[categoria] || 'Serviço';
  return `
    <div class="mini-card">
      <p class="mini-card__titulo">${empresa.nome}</p>
      <p class="mini-card__sub">${label}${empresa.endereco ? ' • ' + empresa.endereco : ''}</p>
      ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" class="mini-card__acao">💬 WhatsApp</a>` : ''}
    </div>
  `;
}

async function carregarVagasDestaque(container) {
  const alvo = container.querySelector('#lista-vagas');
  try {
    const dados = await buscarVagas();
    const itens = (dados.itens || []).slice(0, 6);
    if (itens.length === 0) {
      alvo.innerHTML = `<p class="home-secao__vazio">Nenhuma vaga disponível no momento.</p>`;
      return;
    }
    alvo.innerHTML = itens.map(renderMiniCardVaga).join('');
  } catch (erro) {
    alvo.innerHTML = `<p class="home-secao__vazio">Não foi possível carregar agora.</p>`;
    console.error(erro);
  }
}

function renderMiniCardVaga(vaga) {
  return `
    <div class="mini-card">
      <p class="mini-card__titulo">${vaga.cargo}</p>
      <p class="mini-card__sub">📍 ${vaga.cidade} • ${vaga.quantidade} vaga${vaga.quantidade !== 1 ? 's' : ''}</p>
      <a href="#/vagas" class="mini-card__acao">Ver detalhes</a>
    </div>
  `;
}

async function carregarFretesDestaque(container) {
  const alvo = container.querySelector('#lista-fretes');
  try {
    const fretes = await buscarFretesDestaque(6);
    alvo.innerHTML = fretes.map(renderMiniCardFrete).join('');
  } catch (erro) {
    alvo.innerHTML = `<p class="home-secao__vazio">Não foi possível carregar agora.</p>`;
    console.error(erro);
  }
}

function renderMiniCardFrete(frete) {
  return `
    <div class="mini-card mini-card--exemplo">
      <span class="mini-card__tag-exemplo">EXEMPLO</span>
      <p class="mini-card__titulo">${frete.tipoVeiculo}</p>
      <p class="mini-card__sub">${frete.origem} → ${frete.destino} • ${frete.km} km</p>
    </div>
  `;
}
