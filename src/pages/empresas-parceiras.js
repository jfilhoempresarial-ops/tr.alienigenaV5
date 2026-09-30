import { buscarEmpresasParceiras } from '../services/banners.service.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';
import { apenasDigitos } from '../utils/formatters.js';
import { ativarSegurarParaCopiar } from '../utils/segurar-para-copiar.js';

const MENSAGEM_WHATSAPP = 'Olá, eu vim do site da TR Alienígena e queria saber mais informações.';

/**
 * Deixa só UM número de telefone. Se na planilha vieram dois números juntos
 * (ex.: "(88) 99243-8785 / (88) 3614-3111"), o importador antigo grudava os
 * dois num número enorme e o link do WhatsApp quebrava. Aqui fica só o primeiro.
 */
function numeroUnico(numero) {
  let digitos = apenasDigitos(numero || '');
  if (digitos.startsWith('55') && digitos.length > 11) digitos = digitos.slice(2);
  if (digitos.length > 11) digitos = digitos.slice(0, 11);
  return digitos;
}

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
      <div class="aviso-copiado" id="aviso-whats-copiado" role="status" aria-live="polite"></div>
    </section>
  `;

  const alvo = container.querySelector('#parceiras-lista');
  const aviso = container.querySelector('#aviso-whats-copiado');
  let timerAviso = null;

  function avisar(texto) {
    if (!aviso) return;
    aviso.textContent = texto;
    aviso.classList.add('aviso-copiado--visivel');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => aviso.classList.remove('aviso-copiado--visivel'), 2500);
  }

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

    // WhatsApp: toque abre a conversa; toque e segure copia o link (com a mensagem).
    alvo.querySelectorAll('[data-whats-copiar]').forEach((link) => {
      ativarSegurarParaCopiar(link, {
        obterTexto: () => link.getAttribute('href'),
        avisar,
        mensagemCopiado: '🔗 Link do WhatsApp copiado! É só colar.',
        tituloCompartilhar: 'WhatsApp do parceiro',
      });
    });
  } catch (erro) {
    alvo.innerHTML = `<p class="erro">Não foi possível carregar as empresas parceiras agora.</p>`;
    console.error(erro);
  }
}

function renderCardParceira(empresa, indice) {
  const numero = numeroUnico(empresa.whatsapp);
  const linkWhats = numero.length >= 10 ? gerarLinkWhatsapp(numero, MENSAGEM_WHATSAPP) : null;
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
          ${
            linkWhats
              ? `<a href="${linkWhats}" target="_blank" rel="noopener" class="parceira-card__contato parceira-card__contato--whatsapp" data-whats-copiar title="Toque para abrir • Segure para copiar o link">💬 WhatsApp</a>`
              : ''
          }
          ${linkInstagram ? `<a href="${linkInstagram}" target="_blank" rel="noopener" class="parceira-card__contato parceira-card__contato--instagram">📸 Instagram</a>` : ''}
          ${linkWhats ? `<p class="parceira-card__dica">Segure o botão do WhatsApp para copiar o link.</p>` : ''}
        </div>
      `
          : ''
      }
    </div>
  `;
}
