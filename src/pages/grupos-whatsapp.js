import { buscarGruposWhatsappAtivos } from '../services/grupos-whatsapp.service.js';

export async function renderGruposWhatsapp(container) {
  container.innerHTML = `<p class="loading">Carregando grupos...</p>`;

  let grupos;
  try {
    grupos = await buscarGruposWhatsappAtivos();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar os grupos agora. Tente novamente.</p>`;
    console.error(erro);
    return;
  }

  if (grupos.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhum grupo cadastrado ainda.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="grupos-whatsapp">
      <div class="grupos-whatsapp__header">
        <h1>📱 Grupos de WhatsApp de caminhoneiros</h1>
        <p>Grupos parceiros por cidade — fale direto com o admin para participar</p>
      </div>
      <div class="grupos-whatsapp__lista">
        ${grupos.map(renderCardGrupo).join('')}
      </div>
    </section>
  `;

  ativarModalConsentimento(container);
}

function renderCardGrupo(grupo) {
  const tel = (grupo.whatsapp || '').replace(/\D/g, '');
  return `
    <div class="grupo-card ${grupo.isExemplo ? 'grupo-card--exemplo' : ''}">
      ${grupo.isExemplo ? '<span class="mini-card__tag-exemplo">EXEMPLO</span>' : ''}
      <p class="grupo-card__nome">📱 ${grupo.nomeGrupo}</p>
      <p class="grupo-card__local">📍 ${grupo.cidade}</p>
      <p class="grupo-card__admin">Admin: ${grupo.responsavel}</p>
      ${
        tel
          ? `<button
              type="button"
              class="grupo-card__acao"
              data-nome-grupo="${escaparAtributo(grupo.nomeGrupo)}"
              data-telefone="${tel}"
            >💬 Falar no WhatsApp</button>`
          : ''
      }
    </div>
  `;
}

function escaparAtributo(texto) {
  return String(texto || '').replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Modal de consentimento — mostrado antes de abrir o WhatsApp do admin.
// O motorista confirma que entendeu do que se trata o grupo antes de seguir
// pra conversa. Só depois do "Sim, quero participar" é que o WhatsApp abre,
// já com a mensagem padrão preenchida.
// ---------------------------------------------------------------------------

let estiloModalInjetado = false;

function ativarModalConsentimento(container) {
  container.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.grupo-card__acao');
    if (!botao) return;

    const nomeGrupo = botao.dataset.nomeGrupo;
    const telefone = botao.dataset.telefone;
    abrirModalConsentimento({ nomeGrupo, telefone });
  });
}

function abrirModalConsentimento({ nomeGrupo, telefone }) {
  injetarEstiloModal();

  const overlay = document.createElement('div');
  overlay.className = 'grupo-consentimento-overlay';
  overlay.innerHTML = `
    <div class="grupo-consentimento-modal" role="dialog" aria-modal="true" aria-labelledby="grupo-consentimento-titulo">
      <h2 id="grupo-consentimento-titulo">Antes de entrar no grupo</h2>
      <p>
        O <strong>${escaparAtributo(nomeGrupo)}</strong> é um grupo feito
        <strong>por e para caminhoneiros de verdade</strong> — tem gente
        conversando, avisando sobre estrada, frete, fiscalização e trocando
        informação todos os dias.
      </p>
      <p>
        Antes de falar com o admin, pensa rápido: <strong>faz sentido pra
        você participar</strong> e interagir com o grupo? O espaço é pra
        quem realmente vai usar.
      </p>
      <div class="grupo-consentimento-modal__acoes">
        <button type="button" class="grupo-consentimento-modal__cancelar">Cancelar</button>
        <button type="button" class="grupo-consentimento-modal__confirmar">Sim, quero participar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function fechar() {
    overlay.remove();
  }

  overlay.addEventListener('click', (evento) => {
    if (evento.target === overlay) fechar();
  });

  overlay
    .querySelector('.grupo-consentimento-modal__cancelar')
    .addEventListener('click', fechar);

  overlay
    .querySelector('.grupo-consentimento-modal__confirmar')
    .addEventListener('click', () => {
      const mensagem = `Opa, eu vim do site da TRA. Como faço pra entrar no grupo ${nomeGrupo}?`;
      const link = `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`;
      window.open(link, '_blank', 'noopener');
      fechar();
    });
}

function injetarEstiloModal() {
  if (estiloModalInjetado) return;
  estiloModalInjetado = true;

  const style = document.createElement('style');
  style.id = 'grupo-consentimento-style';
  style.textContent = `
    .grupo-consentimento-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 1000;
    }
    .grupo-consentimento-modal {
      background: #fff;
      border-radius: 12px;
      max-width: 420px;
      width: 100%;
      padding: 24px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    }
    .grupo-consentimento-modal h2 {
      margin: 0 0 12px;
      font-size: 1.15rem;
    }
    .grupo-consentimento-modal p {
      margin: 0 0 12px;
      font-size: 0.95rem;
      line-height: 1.5;
      color: #333;
    }
    .grupo-consentimento-modal__acoes {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }
    .grupo-consentimento-modal__acoes button {
      flex: 1;
      padding: 10px 16px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
    }
    .grupo-consentimento-modal__cancelar {
      background: #eee;
      color: #333;
    }
    .grupo-consentimento-modal__confirmar {
      background: #25D366;
      color: #fff;
    }
  `;
  document.head.appendChild(style);
}