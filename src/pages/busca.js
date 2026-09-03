import { buscarNoSite } from '../services/busca.service.js';
import { renderCardEmpresa } from '../components/card-empresa.js';
import { avaliarEmpresa } from '../services/avaliacoes.service.js';

export function renderBusca(container, termoInicial = '') {
  let termo = termoInicial;

  async function render() {
    container.innerHTML = `
      <section class="busca">
        <input
          type="text"
          id="busca-input"
          class="busca__input"
          placeholder="O que você precisa hoje? (ex: borracharia, vaga motorista, mola)"
          value="${termo}"
        />
        <div id="busca-resultado"></div>
      </section>
    `;

    const input = container.querySelector('#busca-input');
    input.focus();
    input.setSelectionRange(termo.length, termo.length);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        termo = input.value.trim();
        window.history.replaceState({}, '', `/busca?q=${encodeURIComponent(termo)}`);
        renderResultado();
      }
    });

    await renderResultado();
  }

  async function renderResultado() {
    const alvo = container.querySelector('#busca-resultado');

    if (!termo) {
      alvo.innerHTML = `<p class="vazio">Digite algo para começar a busca.</p>`;
      return;
    }

    alvo.innerHTML = `<p class="loading">Buscando por "${termo}"...</p>`;

    let resultado;
    try {
      resultado = await buscarNoSite(termo);
    } catch (erro) {
      alvo.innerHTML = `<p class="erro">Não foi possível buscar agora. Tente novamente.</p>`;
      console.error(erro);
      return;
    }

    const total =
      resultado.empresas.length +
      resultado.vagas.length +
      resultado.fretes.length +
      resultado.grupos.length +
      resultado.aniversariantes.length;

    if (total === 0) {
      alvo.innerHTML = `<p class="vazio">Nenhum resultado para "${termo}". Tente outra palavra.</p>`;
      return;
    }

    alvo.innerHTML = `
      ${resultado.empresas.length ? renderGrupo('🔧 Empresas e serviços', resultado.empresas.map(renderCardEmpresa)) : ''}
      ${resultado.vagas.length ? renderGrupo('💼 Vagas de emprego', resultado.vagas.map(renderCardVaga)) : ''}
      ${resultado.fretes.length ? renderGrupo('📦 Fretes', resultado.fretes.map(renderCardFrete)) : ''}
      ${resultado.grupos.length ? renderGrupo('📱 Grupos de WhatsApp', resultado.grupos.map(renderCardGrupo)) : ''}
      ${resultado.aniversariantes.length ? renderGrupo('🎂 Aniversariantes', resultado.aniversariantes.map(renderCardAniversariante)) : ''}
    `;

    // Liga os botões "Avaliar esta empresa" e as notas — mesma lógica usada
    // em resultados.js (páginas de categoria), agora reaproveitada aqui.
    configurarAvaliacoes(alvo);
  }

  render();
}

function renderGrupo(titulo, itensHtml) {
  return `
    <div class="busca__grupo">
      <h2 class="busca__grupo-titulo">${titulo}</h2>
      <div class="busca__grupo-lista">${itensHtml.join('')}</div>
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

function renderCardFrete(frete) {
  const rota = `${frete.cidadeOrigem}/${frete.estadoOrigem} → ${frete.cidadeDestino}/${frete.estadoDestino}`;
  return `
    <div class="mini-card">
      <p class="mini-card__titulo">${frete.veiculo} • ${frete.carroceria}</p>
      <p class="mini-card__sub">📦 ${frete.carga} — ${rota}</p>
    </div>
  `;
}

function renderCardGrupo(grupo) {
  const tel = (grupo.whatsapp || '').replace(/\D/g, '');
  return `
    <div class="mini-card">
      <p class="mini-card__titulo">📱 ${grupo.nomeGrupo}</p>
      <p class="mini-card__sub">Responsável: ${grupo.responsavel} • 📍 ${grupo.cidade}</p>
      ${tel ? `<a href="https://wa.me/${tel}" target="_blank" rel="noopener" class="mini-card__acao">💬 Falar com o admin</a>` : ''}
    </div>
  `;
}

function renderCardAniversariante(pessoa) {
  const diaFormatado = String(pessoa.dia).padStart(2, '0');
  const mesFormatado = String(pessoa.mes).padStart(2, '0');
  return `
    <div class="mini-card mini-card--aniversario">
      <p class="mini-card__titulo">🎉 ${pessoa.nome}</p>
      <p class="mini-card__sub">${diaFormatado}/${mesFormatado}</p>
    </div>
  `;
}

/** Mesma lógica de resultados.js — liga os botões "Avaliar esta empresa" e as notas de 1 a 10. */
function configurarAvaliacoes(alvo) {
  alvo.querySelectorAll('.card-empresa__avaliar-btn').forEach((botao) => {
    botao.addEventListener('click', () => {
      const empresaId = botao.dataset.abrirAvaliacao;
      const painel = alvo.querySelector(`#avaliar-notas-${empresaId}`);
      if (painel) painel.hidden = !painel.hidden;
    });
  });

  alvo.querySelectorAll('.nota-btn').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const empresaId = botao.dataset.empresaAvaliar;
      const nota = Number(botao.dataset.nota);
      const chaveLocal = `tra-avaliou-${empresaId}`;
      const painel = alvo.querySelector(`#avaliar-notas-${empresaId}`);

      if (localStorage.getItem(chaveLocal)) {
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Você já avaliou esta empresa neste dispositivo. Obrigado! 🙌</p>`;
        }
        return;
      }

      try {
        await avaliarEmpresa(empresaId, nota);
        localStorage.setItem(chaveLocal, '1');
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Obrigado pela avaliação! 🙌</p>`;
        }
      } catch (erro) {
        console.error(erro);
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Não foi possível registrar agora. Tente novamente.</p>`;
        }
      }
    });
  });
}
