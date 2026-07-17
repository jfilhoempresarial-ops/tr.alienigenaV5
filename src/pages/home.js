import { renderCarrosselBanners } from '../components/carrossel-banners.js';
import { buscarEmpresasDestaque } from '../services/empresas.service.js';
import { buscarVagas } from '../services/vagas.service.js';
import { buscarTodosFretes, NOME_ESTADO } from '../services/fretes.service.js';
import { buscarAniversariantesDaSemana, buscarAniversariantesDoMes } from '../services/aniversariantes.service.js';
import { buscarManchetesHome } from '../services/noticias.service.js';

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

function capitalizarNome(txt) {
  return (txt || '')
    .toLowerCase()
    .replace(/(^|\s|\()\S/g, (letra) => letra.toUpperCase());
}

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
          <h2 class="home-secao__titulo" id="titulo-vagas-destaque">💼 Vagas em destaque</h2>
          <a href="/vagas" class="home-secao__ver-todas">Ver todas</a>
        </div>
        <div class="home-secao__lista" id="lista-vagas">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo" id="titulo-fretes-resumo">📦 Fretes disponíveis</h2>
        </div>
        <div class="home-secao__lista" id="lista-fretes">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div id="carrossel-banners-perto"></div>
      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">📍 Perto de você agora</h2>
        </div>
        <div class="home-secao__lista" id="lista-perto-de-voce">
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

      <div id="carrossel-banners-marcas"></div>

     
      <div class="home-secao" id="secao-aniversariantes">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">🎂 Motoristas clientes da Loja do Alienígena</h2>
        </div>
        <div id="aniversariantes-resumo">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>

      <div class="home-secao">
        <div class="home-secao__header">
          <h2 class="home-secao__titulo">📰 Fique por dentro</h2>
          <a href="/noticias" class="home-secao__ver-todas">Ver todas</a>
        </div>
        <div id="manchetes-home" class="manchetes-home">
          <p class="home-secao__vazio">Carregando...</p>
        </div>
      </div>
    </section>
  `;

  renderCarrosselBanners();
  renderCarrosselBanners('carrossel-banners-perto', 'pertodevoce');
  configurarCarrosselCategorias(container);
  configurarBuscaHome(container);
  carregarVagasDestaque(container);
  carregarFretesResumo(container);
  carregarPertoDeVoce(container);
  renderCarrosselBanners('carrossel-banners-marcas', 'home-vertical');
  carregarAniversariantes(container);
  carregarManchetes(container);
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

async function carregarManchetes(container) {
  const alvo = container.querySelector('#manchetes-home');
  try {
    const manchetes = await buscarManchetesHome(3);
    if (manchetes.length === 0) {
      alvo.innerHTML = `<p class="home-secao__vazio">Nenhuma notícia no momento.</p>`;
      return;
    }
    
    const TAG_CATEGORIA = {
  mobilizacao: 'Mobilização',
  rodovia: 'Rodovia',
  seguranca: 'Segurança',
  direitos: 'Direitos',
  geral: 'Geral',
};
    
    alvo.innerHTML = manchetes
      .map(
        (n) => `
      <a href="${n.link}" target="_blank" rel="noopener" class="manchete-card">
        <span class="manchete-card__tag">${TAG_CATEGORIA[n.categoria] || 'Geral'}</span>
        <p class="manchete-card__titulo">${n.titulo}</p>
      </a>
    `
      )
      .join('');
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
  const alvo = container.querySelector('#aniversariantes-resumo');
  try {
    const [semana, mes] = await Promise.all([buscarAniversariantesDaSemana(), buscarAniversariantesDoMes()]);

    if (semana.length === 0) {
      secao.style.display = 'none';
      return;
    }

    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const mesHoje = hoje.getMonth() + 1;

    alvo.innerHTML = `
      <div class="aniversario-card">
        <div class="aniversario-card__header-linha">
          <h3 class="aniversario-card__titulo">📅 Aniversariantes da semana</h3>
          <span class="aniversario-card__contador">${semana.length}</span>
        </div>
        <ul class="aniversario-card__lista">
          ${semana
            .map((p) => {
              const ehHoje = p.dia === diaHoje && p.mes === mesHoje;
              return `<li class="${ehHoje ? 'aniversario-card__item--hoje' : ''}">${ehHoje ? '🎉 ' : ''}${capitalizarNome(p.nome)} — ${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}</li>`;
            })
            .join('')}
        </ul>
        <a href="/aniversariantes-mes" class="aniversario-card__botao-mes">Ver ${mes.length} aniversariante${mes.length !== 1 ? 's' : ''} do mês</a>
      </div>
    `;
  } catch (erro) {
    secao.style.display = 'none';
    console.error(erro);
  }
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

async function carregarFretesResumo(container) {
  const alvo = container.querySelector('#lista-fretes');
  const titulo = container.querySelector('#titulo-fretes-resumo');
  try {
    const fretes = await buscarTodosFretes();

    titulo.textContent = fretes.length
      ? `📦 ${fretes.length} frete${fretes.length !== 1 ? 's' : ''} disponíve${fretes.length !== 1 ? 'is' : 'l'}`
      : '📦 Fretes disponíveis';

    if (fretes.length === 0) {
      alvo.innerHTML = `<p class="home-secao__vazio">Nenhum frete disponível no momento.</p>`;
      return;
    }

    const porEstado = new Map();
    fretes.forEach((f) => {
      const uf = f.estadoOrigem || '??';
      porEstado.set(uf, (porEstado.get(uf) || 0) + 1);
    });

    const ufsOrdenadas = [...porEstado.keys()].sort((a, b) => {
      if (a === 'CE') return -1;
      if (b === 'CE') return 1;
      return a.localeCompare(b);
    });

    alvo.innerHTML = ufsOrdenadas
      .map((uf) => {
        const qtd = porEstado.get(uf);
        const nomeEstado = NOME_ESTADO[uf] || uf;
        return `
          <a href="/fretes?estado=${uf}" class="frete-estado-card">
            <p class="frete-estado-card__titulo">🚛 Saindo de ${nomeEstado}</p>
            <p class="frete-estado-card__sub">${qtd} frete${qtd !== 1 ? 's' : ''}</p>
          </a>
        `;
      })
      .join('');
  } catch (erro) {
    alvo.innerHTML = `<p class="home-secao__vazio">Não foi possível carregar agora.</p>`;
    console.error(erro);
  }
}
