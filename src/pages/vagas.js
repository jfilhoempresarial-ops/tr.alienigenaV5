import { buscarVagas } from '../services/vagas.service.js';
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

/** Lê ?area= e ?cidade= do link, pra dar pra divulgar "só vagas de motorista". */
function lerFiltrosDoLink(cidades) {
  const params = new URLSearchParams(window.location.search);
  const area = params.get('area') || '';
  const cidade = normalizar(params.get('cidade') || '').toUpperCase();
  return {
    area: AREAS.some((a) => a.id === area) ? area : '',
    cidade: cidades.find((c) => normalizar(c).toUpperCase() === cidade) || '',
  };
}

/** Atualiza o endereço da página (sem recarregar), pra o link copiado já vir filtrado. */
function gravarFiltrosNoLink(area, cidade) {
  const params = new URLSearchParams();
  if (area) params.set('area', area);
  if (cidade) params.set('cidade', cidade.toLowerCase());
  const busca = params.toString();
  const novo = `${window.location.pathname}${busca ? `?${busca}` : ''}`;
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
function renderPorArea(lista) {
  return ORDEM_TITULOS.map((id) => {
    const daArea = lista.filter((v) => v.area === id);
    if (!daArea.length) return '';
    const area = AREAS.find((a) => a.id === id);
    const total = somaVagas(daArea);
    return `
      <div class="vagas__grupo-area">
        <h3 class="vagas__area-titulo">${area.rotulo} <span>${total} vaga${total !== 1 ? 's' : ''}</span></h3>
        <div class="vagas__grade">
          ${daArea.map(renderCardVaga).join('')}
        </div>
      </div>
    `;
  }).join('');
}

const MINUSCULAS = ['de', 'da', 'do', 'das', 'dos', 'e'];

/** "JUAZEIRO DO NORTE" → "Juazeiro do Norte" */
function nomeCidade(cidadeBase) {
  return String(cidadeBase || '')
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i > 0 && MINUSCULAS.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/**
 * Lista final: CIDADE (título) → ÁREA (subtítulo, Motoristas primeiro) → vagas.
 * Em Fortaleza, que tem vários postos, o posto aparece em cada card.
 */
function renderPorCidade(lista) {
  const porCidade = new Map();
  lista.forEach((v) => {
    const c = v.cidadeBase || 'NÃO INFORMADO';
    if (!porCidade.has(c)) porCidade.set(c, []);
    porCidade.get(c).push(v);
  });
  return [...porCidade.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
    .map(([cidade, vagasCidade]) => {
      const total = somaVagas(vagasCidade);
      return `
        <section class="vagas__bloco-cidade">
          <h2 class="vagas__cidade-titulo">📍 ${nomeCidade(cidade)} <span>${total} vaga${total !== 1 ? 's' : ''}</span></h2>
          ${renderPorArea(vagasCidade)}
        </section>
      `;
    })
    .join('');
}

export async function renderVagas(container) {
  container.innerHTML = `<p class="loading">Carregando vagas...</p>`;

  let dados;
  try {
    dados = await buscarVagas();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar as vagas agora. Tente novamente em instantes.</p>`;
    console.error(erro);
    return;
  }

  const itens = juntarRepetidas(dados.itens || []).map((v) => ({ ...v, area: areaDoCargo(v.cargo) }));
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
        const bateTexto = !qn || normalizar(v.cidade).includes(qn) || normalizar(v.cargo).includes(qn);
        return bateArea && bateCidade && bateTexto;
      })
      .sort((a, b) => (b.quantidade || 1) - (a.quantidade || 1));
  }

  function render() {
    const filtradas = aplicarFiltros();
    const total = itens.reduce((s, v) => s + (v.quantidade || 1), 0);
    const infoUnidade = filtroCidade && filtradas.length ? renderCardUnidadeSine(filtradas[0]) : '';

    gravarFiltrosNoLink(filtroArea, filtroCidade);

    // Vagas da área escolhida (ou todas), usadas pra contar cidades e o total da cidade
    const daArea = filtroArea ? itens.filter((v) => v.area === filtroArea) : itens;

    // Total de vagas na cidade selecionada (ignora o filtro de texto; respeita a área)
    const totalCidade = filtroCidade ? somaVagas(daArea.filter((v) => v.cidadeBase === filtroCidade)) : 0;

    // Botões de cidade: só as cidades que têm vaga na área do link (se veio ?area=)
    const cidadesDaArea = cidades.filter((c) => c === filtroCidade || daArea.some((v) => v.cidadeBase === c));
    const nomeAreaAtiva = filtroArea ? AREAS.find((a) => a.id === filtroArea).rotulo.replace(/^\S+\s/, '') : '';

    const nomeCidadeExibicao = filtroCidade ? nomeCidade(filtroCidade) : '';

    const conteudoLista = filtradas.length
      ? renderPorCidade(filtradas)
      : '<p class="vazio">Nenhuma vaga encontrada com esse filtro.</p>';

    container.innerHTML = `
      <section class="vagas">
        <div id="carrossel-vagas" class="carrossel-categoria"></div>

        <div class="vagas__header">
          <h1>Vagas de Transporte e Logística do SINE</h1>
          <p>Motoristas, ajudantes, estoque, expedição, logística, máquinas pesadas e manutenção de pesados, perto de você</p>
        </div>

        <div class="vagas__total-destaque">
          ${itens.length ? `Hoje temos <strong>${total}</strong> vaga${total !== 1 ? 's' : ''} de emprego disponíve${total !== 1 ? 'is' : 'l'} na área de transporte` : 'Nenhuma vaga disponível no momento'}
        </div>

        <div class="vagas__resumo">
          <p>📅 Atualizado em: ${formatarDataHora(dados.atualizado)}</p>
          <p class="vagas__aviso">📌 Para se candidatar: dirija-se ao SINE ou DT da sua cidade com sua Carteira de Trabalho e documentação pessoal. O nome da empresa contratante é informado no momento do atendimento.</p>
        </div>

        <input
          type="text"
          id="vagas-busca"
          class="vagas__busca"
          placeholder="Filtrar por cargo ou cidade..."
          value="${filtroTexto}"
        />

        ${
          filtroArea
            ? `<p class="vagas__aviso-area">Mostrando só: <strong>${nomeAreaAtiva}</strong> <button id="vagas-todas-areas" class="chip">Ver todas as áreas</button></p>`
            : ''
        }

        <p class="vagas__filtro-titulo">Cidade</p>
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
    });
  }

  render();
}
