import { buscarEmpresasParceiras } from '../services/banners.service.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';

export async function renderEmpresasParceiras(container) {
  container.innerHTML = `
    <section class="parceiras-pagina">
      <div class="parceiras-pagina__header">
        <h1>🤝 Empresas Parceiras</h1>
        <p>Marcas de confiança que apoiam o motorista brasileiro.</p>
      </div>
      <div class="parceiras-lista" id="parceiras-lista">
        <p class="loading">Carregando...</p>
      </div>
    </section>
  `;

  const alvo = container.querySelector('#parceiras-lista');

  try {
    const parceiras = await buscarEmpresasParceiras();

    if (parceiras.length === 0) {
      alvo.innerHTML = `<p class="vazio">Nenhuma empresa parceira no momento.</p>`;
      return;
    }

    alvo.innerHTML = parceiras.map((empresa, indice) => renderCardParceira(empresa, indice)).join('');

    // "Saiba mais" alterna a visibilidade dos botões de contato daquele card.
    alvo.querySelectorAll('[data-toggle-contato]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const painel = alvo.querySelector(`#parceira-contatos-${botao.dataset.toggleContato}`);
        if (!painel) return;
        const estaAberto = !painel.hidden;
        painel.hidden = estaAberto;
        botao.textContent = estaAberto ? 'Saiba mais' : 'Fechar';
      });
    });
  } catch (erro) {
    alvo.innerHTML = `<p class="erro">Não foi possível carregar as empresas parceiras agora.</p>`;
    console.error(erro);
  }
}

function renderCardParceira(empresa, indice) {
  const linkWhats = empresa.whatsapp
    ? gerarLinkWhatsapp(empresa.whatsapp, 'Olá! Vi seu número no anúncio da TRA e quero saber mais.')
    : null;
  // Se não tiver o campo "instagram" (handle) preenchido, mas o "link" antigo
  // apontar pro instagram.com, aproveita ele como Instagram em vez de perder
  // a informação — vários banners antigos guardavam o perfil ali dentro.
  const linkInstagram = empresa.instagram
    ? `https://www.instagram.com/${empresa.instagram.replace(/^@/, '').trim()}/`
    : empresa.link && /instagram\.com/i.test(empresa.link)
      ? empresa.link
      : null;

  const temAlgumContato = Boolean(linkWhats || linkInstagram);

  return `
    <div class="parceira-card">
      <p class="parceira-card__nome">${empresa.nome}</p>
      ${empresa.descricao ? `<p class="parceira-card__descricao">${empresa.descricao}</p>` : ''}
      ${
        temAlgumContato
          ? `
        <button class="parceira-card__saiba-mais-btn" data-toggle-contato="${indice}">Saiba mais</button>
        <div class="parceira-card__contatos" id="parceira-contatos-${indice}" hidden>
          ${linkWhats ? `<a href="${linkWhats}" target="_blank" rel="noopener" class="parceira-card__contato parceira-card__contato--whatsapp">💬 WhatsApp</a>` : ''}
          ${linkInstagram ? `<a href="${linkInstagram}" target="_blank" rel="noopener" class="parceira-card__contato parceira-card__contato--instagram">📸 Instagram</a>` : ''}
        </div>
      `
          : ''
      }
    </div>
  `;
}