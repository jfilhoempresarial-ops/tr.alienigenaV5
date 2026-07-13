import { buscarVagas } from '../services/vagas.service.js';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarData(iso) {
  if (!iso) return 'ainda não atualizado';
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
    return itens.filter((v) => {
      const bateCidade = !filtroCidade || v.cidadeBase === filtroCidade;
      const bateTexto = !qn || normalizar(v.cidade).includes(qn) || normalizar(v.cargo).includes(qn);
      return bateCidade && bateTexto;
    });
  }

  function render() {
    const filtradas = aplicarFiltros();
    const total = itens.reduce((s, v) => s + (v.quantidade || 1), 0);
    const infoUnidade = filtroCidade && filtradas.length ? renderCardUnidadeSine(filtradas[0]) : '';

    container.innerHTML = `
      <section class="vagas">
        <div class="vagas__header">
          <h1>Vagas para Motoristas do SINE</h1>
          <p>Vagas para motoristas e ajudantes de transporte, próximas a você</p>
        </div>

        <div class="vagas__resumo">
          <p>📅 Atualizado em: ${formatarData(dados.atualizado)}</p>
          <p>🔎 ${itens.length ? `Hoje há ${total} vaga${total !== 1 ? 's' : ''} disponíve${total !== 1 ? 'is' : 'l'} na região` : 'Nenhuma vaga disponível no momento'}</p>
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

        ${infoUnidade}

        <div class="vagas-lista">
          ${filtradas.length ? filtradas.map(renderCardVaga).join('') : '<p class="vazio">Nenhuma vaga encontrada com esse filtro.</p>'}
        </div>
      </section>
    `;

    const inputBusca = container.querySelector('#vagas-busca');
    inputBusca.addEventListener('input', (e) => {
      filtroTexto = e.target.value;
      render();
      // Mantém o foco e o cursor no lugar certo depois do re-render.
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
