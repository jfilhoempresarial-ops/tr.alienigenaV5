import { renderCarrosselBanners } from '../components/carrossel-banners.js';
import { renderCarrosselVertical } from '../components/carrossel-vertical.js';
import { buscarEmpresasDestaque } from '../services/empresas.service.js';
import { buscarVagas } from '../services/vagas.service.js';
import { buscarFretesDestaque } from '../services/fretes.service.js';
import { buscarVitrineAtiva } from '../services/vitrine.service.js';
import { buscarAniversariantesDaSemana } from '../services/aniversariantes.service.js';
function capitalizarNome(txt) {
  return (txt || '')
    .toLowerCase()
    .replace(/(^|\s|\()\S/g, (letra) => letra.toUpperCase());
}

const CATEGORIAS = [
  { id: 'mecanico', label: 'Mecânicos', icone: '🔧' },
  { id: 'posto', label: 'Postos', icone: '⛽' },
  { id: 'borracharia', label: 'Borracharia', icone: '🛞' },
  { id: 'eletrica', label: 'Elétrica', icone: '⚡' },
  { id: 'guincho', label: 'Guincho/Socorro', icone: '🚨' },
  { id: 'pontoapoio', label: 'Pontos de Apoio', icone: '📍' },
  { id: 'vagas', label: 'Vagas de Emprego', icone: '💼', rotaInterna: '/vagas' },
  { id: 'fretes', label: 'Fretes', icone: '📦' },
  { id: 'truckfest', label: 'Truck Fest', icone: '🎪', rotaInterna: '/eventos' },
  { id: 'autopecas', label: 'Auto Peças', icone: '⚙️' },
  { id: 'caminhoes', label: 'Compra e Venda', icone: '🚛', rotaInterna: '/caminhoes' },
  { id: 'noticias', label: 'Notícias', icone: '📰', rotaInterna: '/noticias' },
];

const LABEL_POR_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.label]));

export function renderHome(container) {
  container.innerHTML = `
    <section class="home">
      <div id="carrossel-banners"></div>
      <h1>Motorista, encontre ajuda perto de você</h1>

      <form id="busca-home-form" class="busca-home">
        <input
          type="text"
          id="busca-home-input"
          class="busca-home__input"
          placeholder="O que você precisa hoje? (ex: borracharia, vaga motorista, mola)"
        />
        <button type="submit" class="busca-home__botao" aria-label="Buscar">🔍</button>
      </form>

      <div class="categorias-carrossel">
        <button class="categorias-carrossel__seta categorias-carrossel__seta--esquerda" aria-label="Categorias anteriores">‹</button>
        <div class="categorias-carrossel__trilho" id="categorias-trilho">
          ${CATEGORIAS.map((cat) => {
            const href = cat.externo ?? cat.rotaInterna ?? `/${cat.id}`;
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

      <div class="home-secao" id="secao-aniversariantes">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">🎂 Aniversariantes da semana</h2>
        </div>
        <div class="home-secao__lista" id="lista-aniversariantes">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <a href="/grupos-whatsapp" class="banner-grupos">
        <span class="banner-grupos__icone">📱</span>
        <span class="banner-grupos__texto">
          <strong>Quer participar de grupo de WhatsApp de caminhoneiro?</strong>
          Veja os grupos parceiros por cidade e fale direto com o admin
        </span>
        <span class="banner-grupos__seta">›</span>
      </a>

      <div id="carrossel-vertical-home" class="carrossel-vertical"></div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo" id="titulo-vagas-destaque">💼 Vagas em destaque</h2>
          <a href="/vagas" class="home-secao__ver-todas">Ver todas</a>
        </div>
        <div class="home-secao__lista" id="lista-vagas">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div class="home-secao" id="secao-vitrine">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">🏷️ Marcas parceiras</h2>
        </div>
        <div class="home-secao__lista" id="lista-vitrine">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">📦 Fretes disponíveis</h2>
        </div>
        <div class="home-secao__lista" id="lista-fretes">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>
    </section>
  `;

  renderCarrosselBanners();
  configurarCarrosselCategorias(container);
  configurarBuscaHome(container);
  carregarPertoDeVoce(container);
  carregarAniversariantes(container);
  renderCarrosselVertical('carrossel-vertical-home', 'home-vertical');
  carregarVagasDestaque(container);
  carregarVitrine(container);
  carregarFretesDestaque(container);
}

function configurarBuscaHome(container) {
  const form = container.querySelector('#busca-home-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const termo = container.querySelector('#busca-home-input').value.trim();
    if (!termo) return;
    const url = `/busca?q=${encodeURIComponent(termo)}`;
    window.history.pushState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
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

async function carregarAniversariantes(container) {
  const secao = container.querySelector('#secao-aniversariantes');
  const alvo = container.querySelector('#lista-aniversariantes');
  try {
    const aniversariantes = await buscarAniversariantesDaSemana();
    if (aniversariantes.length === 0) {
      secao.style.display = 'none';
      return;
    }
    alvo.innerHTML = aniversariantes.map(renderMiniCardAniversariante).join('');
  } catch (erro) {
    secao.style.display = 'none';
    console.error(erro);
  }
}

function renderMiniCardAniversariante(pessoa) {
  const diaFormatado = String(pessoa.dia).padStart(2, '0');
  const mesFormatado = String(pessoa.mes).padStart(2, '0');
  return `
    <div class="mini-card mini-card--aniversario">
      <p class="mini-card__titulo">🎉 ${capitalizarNome(pessoa.nome)}</p>
      <p class="mini-card__sub">${diaFormatado}/${mesFormatado}</p>
    </div>
  `;
}

async function carregarVagasDestaque(container) {
  const alvo = container.querySelector('#lista-vagas');
  const titulo = container.querySelector('#titulo-vagas-destaque');
  try {
    const dados = await buscarVagas();
    const todosItens = dados.itens || [];
    const total = todosItens.reduce((s, v) => s + (v.quantidade || 1), 0);

    titulo.textContent = todosItens.length
      ? `💼 ${total} vaga${total !== 1 ? 's' : ''} disponíve${total !== 1 ? 'is' : 'l'} hoje`
      : '💼 Vagas em destaque';

    const itens = [...todosItens]
      .sort((a, b) => (b.quantidade || 1) - (a.quantidade || 1))
      .slice(0, 6);

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
      <a href="/vagas" class="mini-card__acao">Ver detalhes</a>
    </div>
  `;
}

async function carregarVitrine(container) {
  const secao = container.querySelector('#secao-vitrine');
  const alvo = container.querySelector('#lista-vitrine');
  try {
    const itens = await buscarVitrineAtiva();
    if (itens.length === 0) {
      secao.style.display = 'none';
      return;
    }
    alvo.innerHTML = itens.map(renderCardVitrine).join('');
  } catch (erro) {
    secao.style.display = 'none';
    console.error(erro);
  }
}

function renderCardVitrine(item) {
  const imagem = item.imagemUrl || '';
  return `
    <a href="${item.link}" target="_blank" rel="noopener" class="vitrine-card" style="background-image: url('${imagem}')">
      <span class="vitrine-card__overlay"></span>
      <span class="vitrine-card__nome">${item.nome}</span>
    </a>
  `;
}

async function carregarFretesDestaque(container) {
  const alvo = container.querySelector('#lista-fretes');
  try {
    const fretes = await buscarFretesDestaque(6);
    if (fretes.length === 0) {
      alvo.innerHTML = `<p class="home-secao__vazio">Nenhum frete disponível no momento.</p>`;
      return;
    }
    alvo.innerHTML = fretes.map(renderMiniCardFrete).join('');
  } catch (erro) {
    alvo.innerHTML = `<p class="home-secao__vazio">Não foi possível carregar agora.</p>`;
    console.error(erro);
  }
}

function renderMiniCardFrete(frete) {
  const rota = `${frete.cidadeOrigem}/${frete.estadoOrigem} → ${frete.cidadeDestino}/${frete.estadoDestino}`;
  return `
    <div class="mini-card ${frete.isExemplo ? 'mini-card--exemplo' : ''}">
      ${frete.isExemplo ? '<span class="mini-card__tag-exemplo">EXEMPLO</span>' : ''}
      <p class="mini-card__titulo">${frete.veiculo} • ${frete.carroceria}</p>
      <p class="mini-card__sub">📦 ${frete.carga} — ${rota}</p>
      <a href="/fretes" class="mini-card__acao">Ver detalhes</a>
    </div>
  `;
}