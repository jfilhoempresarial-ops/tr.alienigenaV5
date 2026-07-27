import { buscarVagas } from '../services/vagas.service.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

  const itens = dados.itens || [];
  const cidades = [...new Set(itens.map((v) => v.cidadeBase).filter(Boolean))].sort();

  let filtroCidade = '';
  let filtroTexto = '';

  function aplicarFiltros() {
    const qn = normalizar(filtroTexto);
    return itens
      .filter((v) => {
        const bateCidade = !filtroCidade || v.cidadeBase === filtroCidade;
        const bateTexto = !qn || normalizar(v.cidade).includes(qn) || normalizar(v.cargo).includes(qn);
        return bateCidade && bateTexto;
      })
      .sort((a, b) => (b.quantidade || 1) - (a.quantidade || 1));
  }

  function render() {
    const filtradas = aplicarFiltros();
    const total = itens.reduce((s, v) => s + (v.quantidade || 1), 0);
    const infoUnidade = filtroCidade && filtradas.length ? renderCardUnidadeSine(filtradas[0]) : '';

    // Total de vagas na cidade selecionada (ignora o filtro de texto, considera só a cidade)
    const totalCidade = filtroCidade
      ? itens
          .filter((v) => v.cidadeBase === filtroCidade)
          .reduce((s, v) => s + (v.quantidade || 1), 0)
      : 0;

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
          <h1>Vagas para Motoristas do SINE</h1>
          <p>Vagas para motoristas e ajudantes de transporte, próximas a você</p>
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

        <div class="vagas__cidades">
          <button data-cidade="" class="chip ${!filtroCidade ? 'chip--ativo' : ''}">🌐 Todas</button>
          ${cidades
            .map(
              (c) =>
                `<button data-cidade="${c}" class="chip ${filtroCidade === c ? 'chip--ativo' : ''}">${c.charAt(0) + c.slice(1).toLowerCase()}</button>`
            )
            .join('')}
        </div>

        ${
          filtroCidade
            ? `<p class="vagas__total-cidade">📊 Total em ${nomeCidadeExibicao}: <strong>${totalCidade}</strong> vaga${totalCidade !== 1 ? 's' : ''}</p>`
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

    container.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        filtroCidade = btn.dataset.cidade;
        render();
      });
    });
  }

  render();
}