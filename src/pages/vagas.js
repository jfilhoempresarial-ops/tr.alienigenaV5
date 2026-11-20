import { ativarSegurarParaCopiar } from '../utils/segurar-para-copiar.js';
import { buscarVagas, buscarOutrasVagas } from '../services/vagas.service.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// ÁREAS DE ATUAÇÃO (botões acima das cidades)
// A área é descoberta pelo nome do cargo, sem acento. A ordem das regras
// importa: a primeira que bater decide. Para mudar, é só mexer nos termos.
// "id" é o que vai no link: tralienigena.com.br/vagas?area=motoristas
// ---------------------------------------------------------------------------
// A ordem aqui é a ordem dos botões na tela (2 por linha no celular):
// Manutenção | Motoristas · Carga e Estoque | Logística e Frota · Máquinas | Outras
const AREAS = [
  { id: 'manutencao', rotulo: '🔧 Manutenção de Pesados' },
  { id: 'motoristas', rotulo: '🚛 Motoristas' },
  { id: 'carga-estoque', rotulo: '📦 Carga e Estoque' },
  { id: 'logistica', rotulo: '📊 Logística e Frota' },
  { id: 'maquinas', rotulo: '🏗️ Máquinas Pesadas' },
  { id: 'outras', rotulo: '➕ Outras' },
];

const REGRAS_AREA = [
  // mecânico, eletricista e borracheiro (o robô só traz os de veículo pesado)
  { area: 'manutencao', termos: ['mecanico', 'eletricista', 'borracheiro', 'borracharia'] },
  // empilhadeira fica em Carga e Estoque, por isso não está aqui
  {
    area: 'maquinas',
    termos: ['operador de maquina', 'escavadeira', 'retro', 'carregadeira', 'motoniveladora',
      'rolo compactador', 'trator', 'munck', 'munk', 'guindaste', 'guindauto'],
  },
  // "Ajudante de motorista" é carga e descarga, não motorista
  { area: 'carga-estoque', termos: ['ajudante', 'carregador'] },
  {
    area: 'motoristas',
    termos: ['motorista', 'caminhao', 'caminhoneiro', 'carreta', 'carreteiro', 'cacambeiro',
      'bitrem', 'basculante', 'guincho', 'onibus', 'condutor', 'manobr'],
  },
  {
    area: 'logistica',
    termos: ['logistica', 'transporte', 'roteiriz', 'programador', 'trafego', 'frota'],
  },
  {
    area: 'carga-estoque',
    termos: ['carga', 'descarga', 'estoque', 'estoquista', 'almoxarif', 'conferente', 'separador',
      'expedi', 'empilhadeira', 'balanca'],
  },
];

function areaDoCargo(cargo) {
  const c = normalizar(cargo);
  const regra = REGRAS_AREA.find((r) => r.termos.some((t) => c.includes(t)));
  return regra ? regra.area : 'outras';
}

function somaVagas(lista) {
  return lista.reduce((s, v) => s + (v.quantidade || 1), 0);
}

const SITE = 'https://www.tralienigena.com.br';

/** "SÃO GONÇALO DO AMARANTE" → "sao-goncalo-do-amarante" (vai no link) */
function slugCidade(cidade) {
  return normalizar(cidade)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Aba da página: /vagas = Vagas do SINE · /vagas/outras = Outras vagas */
function abaDoLink() {
  const partes = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  return partes[0] === 'vagas' && partes[1] === 'outras' ? 'outras' : 'sine';
}

function caminhoDaAba(aba, cidade) {
  const base = aba === 'outras' ? '/vagas/outras' : '/vagas';
  return cidade ? `${base}/${slugCidade(cidade)}` : base;
}

/** Link de uma cidade: www.tralienigena.com.br/vagas/sobral (ou /vagas/outras/sobral) */
function linkDaCidade(cidade, aba = 'sine') {
  return `${SITE}${caminhoDaAba(aba, cidade)}`;
}

/**
 * Lê a cidade do link: /vagas/sobral (jeito novo) ou ?cidade=sobral (links antigos).
 * Aceita maiúscula, acento e espaço: /vagas/Sobral, /vagas/São%20Gonçalo...
 * Também lê ?area= de links antigos.
 */
function lerFiltrosDoLink(cidades) {
  const params = new URLSearchParams(window.location.search);
  const area = params.get('area') || '';
  const partes = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
  const posicao = partes[1] === 'outras' ? 2 : 1;
  let pedido = partes[0] === 'vagas' && partes[posicao] ? partes[posicao] : params.get('cidade') || '';
  try {
    pedido = decodeURIComponent(pedido);
  } catch {
    // link quebrado: ignora
  }
  const slug = slugCidade(pedido);
  return {
    area: AREAS.some((a) => a.id === area) ? area : '',
    cidade: slug ? cidades.find((c) => slugCidade(c) === slug) || '' : '',
  };
}

/** Atualiza o endereço da página (sem recarregar): /vagas/sobral */
function gravarFiltrosNoLink(area, cidade, aba = 'sine') {
  const caminho = caminhoDaAba(aba, cidade);
  const novo = `${caminho}${area ? `?area=${area}` : ''}`;
  if (novo !== window.location.pathname + window.location.search) {
    window.history.replaceState({}, '', novo);
  }
}

function formatarDataHora(iso) {
  if (!iso) return 'ainda não atualizado';
  const data = new Date(iso);
  const dataFormatada = data.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const horaFormatada = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dataFormatada}, às ${horaFormatada}`;
}

/**
 * Link do Google Maps até o SINE da vaga.
 * Usa as coordenadas da unidade quando o IDT manda; se não, o endereço;
 * e, sem endereço, procura "SINE <cidade> CE".
 */
function linkLocalizacaoSine(vaga) {
  if (Number.isFinite(vaga.lat) && Number.isFinite(vaga.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${vaga.lat},${vaga.lng}`;
  }
  const municipio = vaga.cidadeBase ? vaga.cidadeBase.charAt(0) + vaga.cidadeBase.slice(1).toLowerCase() : vaga.cidade;
  const busca = vaga.endereco ? `${vaga.endereco}, ${municipio} - CE` : `SINE ${vaga.unidade || municipio} CE`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(busca)}`;
}

function renderBotoesSine(vaga) {
  const tel = (vaga.fone || '').replace(/\D/g, '');
  return `
    ${tel ? `<a href="tel:+55${tel}" class="btn-ligar">📞 Ligar</a>` : ''}
    <a href="${linkLocalizacaoSine(vaga)}" target="_blank" rel="noopener" class="btn-localizacao">📍 Localização do SINE</a>
  `;
}

function renderCardUnidadeSine(vaga) {
  const tel = (vaga.fone || '').replace(/\D/g, '');
  if (!vaga.endereco && !tel && !vaga.email) return '';
  return `
    <div class="sine-unidade">
      <div class="sine-unidade__titulo">🏛️ SINE — ${vaga.cidade}</div>
      ${vaga.endereco ? `<div class="sine-unidade__linha">📍 ${vaga.endereco}</div>` : ''}
      ${tel ? `<div class="sine-unidade__linha">📞 ${vaga.fone}</div>` : ''}
      ${vaga.email ? `<div class="sine-unidade__linha">✉️ ${vaga.email}</div>` : ''}
      <div class="sine-unidade__acoes">
        ${renderBotoesSine(vaga)}
        ${vaga.email ? `<a href="mailto:${vaga.email}" class="btn-email">✉️ E-mail</a>` : ''}
      </div>
    </div>
  `;
}

function textoQuantidade(vaga) {
  const q = vaga.quantidade || 1;
  const pcd = vaga.qtdPcd || 0;
  const base = `${q} vaga${q !== 1 ? 's' : ''}`;
  if (!pcd) return base;
  if (pcd >= q) return `${base} • ♿ exclusiva${q !== 1 ? 's' : ''} para PcD`;
  return `${base} (${pcd} exclusiva${pcd !== 1 ? 's' : ''} para PcD)`;
}

function renderCardVaga(vaga) {
  return `
    <div class="vaga-card">
      <div class="vaga-card__cargo">${vaga.cargo}</div>
      <div class="vaga-card__local">📍 ${vaga.cidade} • ${textoQuantidade(vaga)}</div>
      <div class="vaga-card__acoes">
        ${renderBotoesSine(vaga)}
      </div>
    </div>
  `;
}

/**
 * Junta vagas repetidas: mesma cidade/posto + mesmo cargo vira UM card,
 * somando as vagas ("Motorista entregador • 2 vagas" em vez de dois cards
 * de 1 vaga). Vagas exclusivas PcD entram na soma e aparecem no texto.
 */
function juntarRepetidas(lista) {
  const porChave = new Map();
  for (const v of lista) {
    const chave = `${normalizar(v.cidade)}|${normalizar(v.cargo).replace(/\s+/g, ' ').trim()}`;
    const qtd = v.quantidade || 1;
    const pcd = v.tipo === 'Exclusiva PcD' ? qtd : v.qtdPcd || 0;
    const existente = porChave.get(chave);
    if (existente) {
      existente.quantidade += qtd;
      existente.qtdPcd += pcd;
    } else {
      porChave.set(chave, { ...v, quantidade: qtd, qtdPcd: pcd });
    }
  }
  return [...porChave.values()];
}

// Ordem dos títulos de área dentro da cidade: Motoristas sempre primeiro
const ORDEM_TITULOS = ['motoristas', 'carga-estoque', 'logistica', 'maquinas', 'manutencao', 'outras'];

/** Dentro da cidade: título da área e, embaixo, as vagas daquela área. */
function renderPorArea(lista, renderCard = renderCardVaga) {
  return ORDEM_TITULOS.map((id) => {
    const daArea = lista.filter((v) => v.area === id);
    if (!daArea.length) return '';
    const area = AREAS.find((a) => a.id === id);
    const total = somaVagas(daArea);
    return `
      <div class="vagas__grupo-area">
        <h3 class="vagas__area-titulo">${area.rotulo} <span>${total} vaga${total !== 1 ? 's' : ''}</span></h3>
        <div class="vagas__grade">
          ${daArea.map(renderCard).join('')}
        </div>
      </div>
    `;
  }).join('');
}

const MINUSCULAS = ['de', 'da', 'do', 'das', 'dos', 'e'];

/** "JUAZEIRO DO NORTE" → "Juazeiro do Norte" */
function nomeCidade(cidadeBase) {
  let dentroDeParenteses = false;
  return String(cidadeBase || '')
    .toLowerCase()
    .split(' ')
    .map((p, i) => {
      if (p.startsWith('(')) dentroDeParenteses = true;
      const manter = dentroDeParenteses || (i > 0 && MINUSCULAS.includes(p));
      return manter ? p : p.charAt(0).toUpperCase() + p.slice(1);
    })
    .join(' ');
}

// ---------------------------------------------------------------------------
// OUTRAS VAGAS (Jooble + Vagas Indicadas). Os textos vêm de sites de fora,
// então TUDO passa por escapar() antes de ir para a tela.
// ---------------------------------------------------------------------------
function escapar(txt) {
  return String(txt == null ? '' : txt).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

const FONTES = {
  indicada: '⭐ Indicada pela TR Alienígena',
  jooble: 'via Jooble',
  adzuna: 'via Adzuna',
};

function tempoDesde(isoData) {
  if (!isoData) return '';
  const dias = Math.floor((Date.now() - new Date(`${isoData}T12:00:00`).getTime()) / 86400000);
  if (dias <= 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

function renderContatoOutraVaga(contato, cargo) {
  const c = String(contato || '').trim();
  if (!c) return '';
  if (c.includes('@')) {
    return `<a href="mailto:${escapar(c)}" class="btn-email">✉️ E-mail</a>`;
  }
  let tel = c.replace(/\D/g, '');
  if (tel.startsWith('55') && tel.length > 11) tel = tel.slice(2);
  if (tel.length < 10) return '';
  const msg = encodeURIComponent(`Olá! Vi a vaga de ${cargo} no site da TR Alienígena e queria saber mais.`);
  return `
    <a href="tel:+55${tel}" class="btn-ligar">📞 Ligar</a>
    <a href="https://wa.me/55${tel}?text=${msg}" target="_blank" rel="noopener" class="btn-whatsapp">💬 WhatsApp</a>
  `;
}

function renderCardOutraVaga(vaga) {
  const link = /^https?:\/\//i.test(vaga.link || '') ? vaga.link : '';
  const quando = tempoDesde(vaga.publicado);
  const contato = renderContatoOutraVaga(vaga.contato, vaga.cargo);
  return `
    <div class="vaga-card vaga-card--outra">
      <div class="vaga-card__cargo">${escapar(vaga.cargo)}</div>
      ${vaga.empresa ? `<div class="vaga-card__empresa">🏢 ${escapar(vaga.empresa)}</div>` : ''}
      <div class="vaga-card__local">📍 ${escapar(vaga.cidade)}${quando ? ` • ${quando}` : ''}</div>
      ${vaga.salario ? `<div class="vaga-card__salario">💰 ${escapar(vaga.salario)}</div>` : ''}
      <div class="vaga-card__fonte vaga-card__fonte--${escapar(vaga.fonte)}">${FONTES[vaga.fonte] || ''}</div>
      ${
        link || contato
          ? `<div class="vaga-card__acoes">
              ${link ? `<a href="${escapar(link)}" target="_blank" rel="noopener nofollow" class="btn-localizacao">🔗 Ver vaga</a>` : ''}
              ${contato}
            </div>`
          : ''
      }
    </div>
  `;
}

/**
 * Lista final: CIDADE (título) → ÁREA (subtítulo, Motoristas primeiro) → vagas.
 * Em Fortaleza, que tem vários postos, o posto aparece em cada card.
 */
function renderPorCidade(lista, renderCard = renderCardVaga) {
  const porCidade = new Map();
  lista.forEach((v) => {
    const c = v.cidadeBase || 'NÃO INFORMADO';
    if (!porCidade.has(c)) porCidade.set(c, []);
    porCidade.get(c).push(v);
  });
  return [...porCidade.entries()]
    // "Ceará (várias cidades)" vai pro fim; o resto em ordem alfabética
    .sort((a, b) => a[0].includes('(') - b[0].includes('(') || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([cidade, vagasCidade]) => {
      const total = somaVagas(vagasCidade);
      return `
        <section class="vagas__bloco-cidade">
          <h2 class="vagas__cidade-titulo">📍 ${nomeCidade(cidade)} <span>${total} vaga${total !== 1 ? 's' : ''}</span></h2>
          ${renderPorArea(vagasCidade, renderCard)}
        </section>
      `;
    })
    .join('');
}

export async function renderVagas(container) {
  const aba = abaDoLink();
  const ehOutras = aba === 'outras';
  container.innerHTML = `<p class="loading">Carregando vagas...</p>`;

  let dados;
  try {
    dados = ehOutras ? await buscarOutrasVagas() : await buscarVagas();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar as vagas agora. Tente novamente em instantes.</p>`;
    console.error(erro);
    return;
  }

  const brutos = ehOutras ? (dados.itens || []).map((v) => ({ ...v, quantidade: 1 })) : juntarRepetidas(dados.itens || []);
  const itens = brutos.map((v) => ({ ...v, area: areaDoCargo(v.cargo) }));
  const renderCard = ehOutras ? renderCardOutraVaga : renderCardVaga;
  const cidades = [...new Set(itens.map((v) => v.cidadeBase).filter(Boolean))].sort();

  const doLink = lerFiltrosDoLink(cidades);
  let filtroArea = doLink.area;
  let filtroCidade = doLink.cidade;
  let filtroTexto = '';

  function aplicarFiltros() {
    const qn = normalizar(filtroTexto);
    return itens
      .filter((v) => {
        const bateArea = !filtroArea || v.area === filtroArea;
        const bateCidade = !filtroCidade || v.cidadeBase === filtroCidade;
        const bateTexto =
          !qn ||
          normalizar(v.cidade).includes(qn) ||
          normalizar(v.cargo).includes(qn) ||
          normalizar(v.empresa || '').includes(qn);
        return bateArea && bateCidade && bateTexto;
      })
      .sort((a, b) =>
        ehOutras
          ? (a.fonte === 'indicada' ? -1 : 0) - (b.fonte === 'indicada' ? -1 : 0) ||
            String(b.publicado || '').localeCompare(String(a.publicado || ''))
          : (b.quantidade || 1) - (a.quantidade || 1)
      );
  }

  // Aviso "Link copiado!" (fica fora do container, que é redesenhado a cada filtro)
  let aviso = document.getElementById('aviso-vagas-copiado');
  if (!aviso) {
    aviso = document.createElement('div');
    aviso.id = 'aviso-vagas-copiado';
    aviso.className = 'aviso-copiado';
    aviso.setAttribute('role', 'status');
    aviso.setAttribute('aria-live', 'polite');
    document.body.appendChild(aviso);
  }
  let timerAviso = null;
  function avisar(texto) {
    aviso.textContent = texto;
    aviso.classList.add('aviso-copiado--visivel');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => aviso.classList.remove('aviso-copiado--visivel'), 2500);
  }

  function render() {
    const filtradas = aplicarFiltros();
    const total = itens.reduce((s, v) => s + (v.quantidade || 1), 0);
    const infoUnidade = !ehOutras && filtroCidade && filtradas.length ? renderCardUnidadeSine(filtradas[0]) : '';

    gravarFiltrosNoLink(filtroArea, filtroCidade, aba);

    // Vagas da área escolhida (ou todas), usadas pra contar cidades e o total da cidade
    const daArea = filtroArea ? itens.filter((v) => v.area === filtroArea) : itens;

    // Total de vagas na cidade selecionada (ignora o filtro de texto; respeita a área)
    const totalCidade = filtroCidade ? somaVagas(daArea.filter((v) => v.cidadeBase === filtroCidade)) : 0;

    // Botões de cidade: só as cidades que têm vaga na área do link (se veio ?area=)
    const cidadesDaArea = cidades.filter((c) => c === filtroCidade || daArea.some((v) => v.cidadeBase === c));
    const nomeAreaAtiva = filtroArea ? AREAS.find((a) => a.id === filtroArea).rotulo.replace(/^\S+\s/, '') : '';

    const nomeCidadeExibicao = filtroCidade ? nomeCidade(filtroCidade) : '';

    const conteudoLista = filtradas.length
      ? renderPorCidade(filtradas, renderCard)
      : '<p class="vazio">Nenhuma vaga encontrada com esse filtro.</p>';

    container.innerHTML = `
      <section class="vagas">
        <div id="carrossel-vagas" class="carrossel-categoria"></div>

        <nav class="vagas__abas" aria-label="Tipo de vaga">
          <a href="${caminhoDaAba('sine', filtroCidade)}" class="vagas__aba ${!ehOutras ? 'vagas__aba--ativa' : ''}">🏛️ Vagas do SINE</a>
          <a href="${caminhoDaAba('outras', filtroCidade)}" class="vagas__aba ${ehOutras ? 'vagas__aba--ativa' : ''}">🌐 Outras vagas</a>
        </nav>

        <div class="vagas__header">
          ${
            ehOutras
              ? `<h1>Outras vagas de Transporte e Logística</h1>
                 <p>Vagas de sites de emprego e de empresas da região, e vagas indicadas pela TR Alienígena</p>`
              : `<h1>Vagas de Transporte e Logística do SINE</h1>
                 <p>Motoristas, ajudantes, estoque, expedição, logística, máquinas pesadas e manutenção de pesados, perto de você</p>`
          }
        </div>

        <div class="vagas__total-destaque">
          ${itens.length ? `Hoje temos <strong>${total}</strong> vaga${total !== 1 ? 's' : ''} de emprego disponíve${total !== 1 ? 'is' : 'l'} na área de transporte` : 'Nenhuma vaga disponível no momento'}
        </div>

        <div class="vagas__resumo">
          <p>📅 Atualizado em: ${formatarDataHora(dados.atualizado)}</p>
          ${
            ehOutras
              ? `<p class="vagas__aviso">📌 Para se candidatar: toque em <strong>Ver vaga</strong> e siga as instruções do site da vaga, ou fale direto pelo contato. Estas vagas não são do SINE: confira os dados com a empresa e nunca pague para se candidatar.</p>`
              : `<p class="vagas__aviso">📌 Para se candidatar: dirija-se ao SINE ou DT da sua cidade com sua Carteira de Trabalho e documentação pessoal. O nome da empresa contratante é informado no momento do atendimento.</p>`
          }
        </div>

        <input
          type="text"
          id="vagas-busca"
          class="vagas__busca"
          placeholder="${ehOutras ? 'Filtrar por cargo, cidade ou empresa...' : 'Filtrar por cargo ou cidade...'}"
          value="${filtroTexto}"
        />

        ${
          filtroArea
            ? `<p class="vagas__aviso-area">Mostrando só: <strong>${nomeAreaAtiva}</strong> <button id="vagas-todas-areas" class="chip">Ver todas as áreas</button></p>`
            : ''
        }

        <p class="vagas__filtro-titulo">Cidade <span class="vagas__dica-copiar">· segure o nome para copiar o link</span></p>
        <div class="vagas__cidades">
          <button data-cidade="" class="chip ${!filtroCidade ? 'chip--ativo' : ''}">🌐 Todas</button>
          ${cidadesDaArea
            .map(
              (c) =>
                `<button data-cidade="${c}" class="chip ${filtroCidade === c ? 'chip--ativo' : ''}">${nomeCidade(c)}</button>`
            )
            .join('')}
        </div>

        ${
          filtroCidade
            ? `<p class="vagas__total-cidade">📊 Total em ${nomeCidadeExibicao}${nomeAreaAtiva ? ` (${nomeAreaAtiva})` : ''}: <strong>${totalCidade}</strong> vaga${totalCidade !== 1 ? 's' : ''}</p>`
            : ''
        }

        ${infoUnidade}

        <div class="vagas-lista">
          ${conteudoLista}
        </div>
      </section>
    `;

    renderCarrosselBanners('carrossel-vagas', 'vagas');

    const inputBusca = container.querySelector('#vagas-busca');
    inputBusca.addEventListener('input', (e) => {
      filtroTexto = e.target.value;
      render();
      const alvo = container.querySelector('#vagas-busca');
      alvo.focus();
      alvo.setSelectionRange(filtroTexto.length, filtroTexto.length);
    });

    const botaoTodasAreas = container.querySelector('#vagas-todas-areas');
    if (botaoTodasAreas) {
      botaoTodasAreas.addEventListener('click', () => {
        filtroArea = '';
        render();
      });
    }

    container.querySelectorAll('.vagas__cidades .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filtroCidade = btn.dataset.cidade;
        render();
      });
      // Toque e segure: copia www.tralienigena.com.br/vagas/<cidade> pra colar na conversa
      ativarSegurarParaCopiar(btn, {
        obterTexto: () => linkDaCidade(btn.dataset.cidade, aba),
        avisar,
        mensagemCopiado: btn.dataset.cidade
          ? `🔗 Link das vagas de ${nomeCidade(btn.dataset.cidade)} copiado!`
          : '🔗 Link das vagas copiado!',
        tituloCompartilhar: 'Vagas de emprego',
      });
    });
  }

  render();
}
