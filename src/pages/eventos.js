import { buscarEventosAtivos } from '../services/eventos.service.js';
import { formatarDataEvento } from '../utils/formatters.js';

// Rede de segurança: sem isso, se a consulta ao Firestore der erro (ex: falta
// um índice composto) ou travar (sinal fraco de rodovia), a página ficava
// presa em "Carregando eventos..." pra sempre, sem nunca mostrar nada.
function comTimeout(promessa, ms = 12000) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ao carregar eventos')), ms)),
  ]);
}

/**
 * Calcula quantos dias faltam até a data do evento (formato "AAAA-MM-DD").
 * Retorna null se a data vier vazia ou num formato que não conseguimos ler.
 */
function calcularDiasRestantes(dataStr) {
  if (!dataStr) return null;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  // Monta a data à meia-noite local, evitando o problema comum de "new Date('AAAA-MM-DD')"
  // interpretar como UTC e às vezes mostrar o dia errado dependendo do fuso do navegador.
  const partes = String(dataStr).split('-');
  if (partes.length !== 3) return null;
  const [ano, mes, dia] = partes.map(Number);
  const dataEvento = new Date(ano, mes - 1, dia);
  if (isNaN(dataEvento.getTime())) return null;

  const diffMs = dataEvento.getTime() - hoje.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/** Monta o selo de contagem regressiva ("Faltam X dias", "É amanhã!", etc.) */
function renderContagemRegressiva(dataStr) {
  const dias = calcularDiasRestantes(dataStr);
  if (dias === null) return '';

  if (dias > 1) {
    return `<p class="card-evento__contagem">⏳ Faltam ${dias} dias</p>`;
  }
  if (dias === 1) {
    return `<p class="card-evento__contagem">⏳ É amanhã!</p>`;
  }
  if (dias === 0) {
    return `<p class="card-evento__contagem card-evento__contagem--hoje">🎉 É hoje!</p>`;
  }
  return `<p class="card-evento__contagem card-evento__contagem--passado">✅ Evento já realizado</p>`;
}

export async function renderEventos(container) {
  container.innerHTML = `<p class="loading">Carregando eventos...</p>`;

  let eventos;
  try {
    eventos = await comTimeout(buscarEventosAtivos());
  } catch (erro) {
    container.innerHTML = `
      <div class="erro-carregamento">
        <p class="erro">Não foi possível carregar os eventos agora. Tente novamente.</p>
        <button id="tentar-carregar-eventos" class="btn-secundario">🔄 Tentar de novo</button>
      </div>
    `;
    console.error(erro);
    const botao = container.querySelector('#tentar-carregar-eventos');
    if (botao) botao.addEventListener('click', () => renderEventos(container));
    return;
  }

  if (eventos.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhum evento programado no momento. Volte em breve!</p>`;
    return;
  }

  container.innerHTML = `
    <section class="eventos">
      <h2>Truck Fest — Eventos</h2>
      <div class="eventos-lista">
        ${eventos
          .map(
            (evento) => `
          <div class="card-evento">
            ${evento.imagemUrl ? `<img src="${evento.imagemUrl}" alt="${evento.titulo}" class="card-evento__imagem" loading="lazy" />` : ''}
            <div class="card-evento__conteudo">
              <h3>${evento.titulo}</h3>
              <p class="card-evento__data">${formatarDataEvento(evento.data)}</p>
              ${renderContagemRegressiva(evento.data)}
              <p class="card-evento__local">${evento.local ?? ''}</p>
              <p class="card-evento__descricao">${evento.descricao ?? ''}</p>
              ${evento.link ? `<a href="${evento.link}" target="_blank" rel="noopener" class="card-evento__link">Saiba mais</a>` : ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>
  `;
}
