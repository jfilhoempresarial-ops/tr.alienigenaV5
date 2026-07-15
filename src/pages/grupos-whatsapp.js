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
          ? `<a href="https://wa.me/${tel}?text=${encodeURIComponent('Vi seu grupo no TRA da Estrada, quero participar!')}" target="_blank" rel="noopener" class="grupo-card__acao">💬 Falar no WhatsApp</a>`
          : ''
      }
    </div>
  `;
}
