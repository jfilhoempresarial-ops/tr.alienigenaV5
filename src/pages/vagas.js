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
        ${tel ? `<a href="tel:+55${tel}" class="btn-ligar">📞 Ligar</a>` : ''}
        ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" class="btn-whatsapp">💬 WhatsApp</a>` : ''}
        ${vaga.email ? `<a href="mailto:${vaga.email}" class="btn-email">✉️ E-mail</a>` : ''}
      </div>
    </div>
  `;
}

function renderCardVaga(vaga) {
  const tel = (vaga.fone || '').replace(/\D/g, '');
  return `
    <div class="vaga-card">
      <div class="vaga-card__cargo">${vaga.cargo}</div>
      <div class="vaga-card__local">📍 ${vaga.cidade} • ${vaga.quantidade} vaga${vaga.quantidade !== 1 ? 's' : ''}</div>
      ${vaga.tipo === 'Exclusiva PcD' ? `<div class="vaga-card__local">♿ Exclusiva para PcD</div>` : ''}
      <div class="vaga-card__acoes">
        ${tel ? `<a href="tel:+55${tel}" class="btn-ligar">📞 Ligar</a>` : ''}
        ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" class="btn-whatsapp">💬 WhatsApp</a>` : ''}
      </div>
    </div>
  `;
}

function agruparPorPosto(lista) {
  const grupos = new Map();
  lista.forEach((v) => {
    const posto = v.cidade || 'Não informado';
    if (!grupos.has(posto)) grupos.set(posto, []);
    grupos.get(posto).push(v);
  });
  return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}

function renderGrupoPosto(posto, vagasPosto) {
  const totalPosto = vagasPosto.reduce((s, v) => s + (v.quantidade || 1), 0);
  return `
    <div class="vagas__grupo-posto">
      <h3 class="vagas__posto-titulo">📍 ${posto} — ${totalPosto} vaga${totalPosto !== 1 ? 's' : ''}</h3>
      ${vagasPosto.map(renderCardVaga).join('')}
    </div>
  `;
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

  const itens = (dados.itens || []).map((v) => ({ ...v, area: areaDoCargo(v.cargo) }));
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
    const daCidade = filtroCidade ? itens.filter((v) => v.cidadeBase === filtroCidade) : itens;

    // Total de vagas na cidade selecionada (ignora o filtro de texto; respeita a área)
    const totalCidade = filtroCidade ? somaVagas(daArea.filter((v) => v.cidadeBase === filtroCidade)) : 0;

    // Botões de área: só as áreas que têm vaga (na cidade escolhida, se tiver), com o número de vagas
    const botoesArea = AREAS.map((a) => ({ ...a, total: somaVagas(daCidade.filter((v) => v.area === a.id)) }))
      .filter((a) => a.total > 0 || a.id === filtroArea)
      .map(
        (a) =>
          `<button data-area="${a.id}" class="chip chip--area ${filtroArea === a.id ? 'chip--ativo' : ''}"><span class="chip__rotulo">${a.rotulo}</span> <span class="chip__num">${a.total}</span></button>`
      )
      .join('');

    // Botões de cidade: só as cidades que têm vaga na área escolhida
    const cidadesDaArea = cidades.filter((c) => c === filtroCidade || daArea.some((v) => v.cidadeBase === c));
    const nomeAreaAtiva = filtroArea ? AREAS.find((a) => a.id === filtroArea).rotulo.replace(/^\S+\s/, '') : '';

    const nomeCidadeExibicao = filtroCidade
      ? filtroCidade.charAt(0) + filtroCidade.slice(1).toLowerCase()
      : '';

    const ehFortaleza = filtroCidade.toUpperCase() === 'FORTALEZA';

    let conteudoLista;
    if (!filtradas.length) {
      conteudoLista = '<p class="vazio">Nenhuma vaga encontrada com esse filtro.</p>';
    } else if (ehFortaleza) {
      conteudoLista = agruparPorPosto(filtradas)
        .map(([posto, vagasPosto]) => renderGrupoPosto(posto, vagasPosto))
        .join('');
    } else {
      conteudoLista = filtradas.map(renderCardVaga).join('');
    }

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

        <p class="vagas__filtro-titulo">Área de atuação</p>
        <div class="vagas__areas">
          <button data-area="" class="chip chip--area chip--area-todas ${!filtroArea ? 'chip--ativo' : ''}"><span class="chip__rotulo">🌐 Todas as áreas</span> <span class="chip__num">${somaVagas(daCidade)}</span></button>
          ${botoesArea}
        </div>

        <p class="vagas__filtro-titulo">Cidade</p>
        <div class="vagas__cidades">
          <button data-cidade="" class="chip ${!filtroCidade ? 'chip--ativo' : ''}">🌐 Todas</button>
          ${cidadesDaArea
            .map(
              (c) =>
                `<button data-cidade="${c}" class="chip ${filtroCidade === c ? 'chip--ativo' : ''}">${c.charAt(0) + c.slice(1).toLowerCase()}</button>`
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

    container.querySelectorAll('.vagas__areas .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filtroArea = btn.dataset.area;
        render();
      });
    });

    container.querySelectorAll('.vagas__cidades .chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filtroCidade = btn.dataset.cidade;
        render();
      });
    });
  }

  render();
}