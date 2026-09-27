import { buscarEventosAtivos } from '../services/eventos.service.js';
import { formatarDataEvento } from '../utils/formatters.js';
import { DATAS_COMEMORATIVAS } from '../data/datas-comemorativas.js';

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

/** Monta a descrição em tópicos (evento.detalhes) ou, se não tiver, o texto corrido antigo (evento.descricao). */
function renderDetalhes(evento) {
  if (Array.isArray(evento.detalhes) && evento.detalhes.length > 0) {
    return `<ul class="card-evento__detalhes">${evento.detalhes.map((item) => `<li>${item}</li>`).join('')}</ul>`;
  }
  if (evento.descricao) {
    return `<p class="card-evento__descricao">${evento.descricao}</p>`;
  }
  return '';
}

/** Botão "Como chegar", usando o campo "local" (cidade/endereço) numa busca do Google Maps. */
function renderBotaoLocalizacao(local) {
  if (!local) return '';
  const link = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(local)}`;
  return `<a href="${link}" target="_blank" rel="noopener" class="card-evento__mapa-btn">🧭 Como chegar</a>`;
}

const NOMES_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/**
 * Próxima vez que uma data comemorativa acontece (este ano ou o próximo).
 * Se for um período (ex.: Semana Nacional de Trânsito) e ele estiver
 * acontecendo agora, continua valendo o deste ano até o último dia.
 */
function proximaOcorrencia(item, hoje) {
  const ano = hoje.getFullYear();
  const fimDia = item.ateDia || item.dia;
  const fimMes = item.ateMes || item.mes;
  const fimEsteAno = new Date(ano, fimMes - 1, fimDia);
  const anoCerto = fimEsteAno < hoje ? ano + 1 : ano;
  return {
    inicio: new Date(anoCerto, item.mes - 1, item.dia),
    fim: new Date(anoCerto, fimMes - 1, fimDia),
  };
}

function textoPeriodo(item) {
  const inicio = `${item.dia} de ${NOMES_MESES[item.mes - 1]}`;
  if (!item.ateDia) return inicio;
  if (item.ateMes === item.mes) return `${item.dia} a ${item.ateDia} de ${NOMES_MESES[item.mes - 1]}`;
  return `${inicio} a ${item.ateDia} de ${NOMES_MESES[item.ateMes - 1]}`;
}

function textoContagem(inicio, fim, hoje) {
  const umDia = 1000 * 60 * 60 * 24;
  const dias = Math.round((inicio.getTime() - hoje.getTime()) / umDia);
  if (dias > 1) return `<span class="calendario-item__contagem">Faltam ${dias} dias</span>`;
  if (dias === 1) return `<span class="calendario-item__contagem">É amanhã!</span>`;
  if (dias === 0 || (dias < 0 && fim >= hoje)) {
    return `<span class="calendario-item__contagem calendario-item__contagem--hoje">${dias === 0 ? 'É hoje!' : 'Acontecendo agora'}</span>`;
  }
  return '';
}

/** Seção "Calendário do Transporte", com as datas comemorativas na ordem da mais próxima. */
function renderCalendario() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const itens = DATAS_COMEMORATIVAS.map((item) => ({ item, ...proximaOcorrencia(item, hoje) })).sort(
    (a, b) => a.inicio - b.inicio
  );

  return `
    <section class="calendario-transporte">
      <h2>Calendário do Transporte</h2>
      <p class="calendario-transporte__intro">Datas comemorativas do caminhoneiro, do motorista e do transporte.</p>
      <ul class="calendario-lista">
        ${itens
          .map(
            ({ item, inicio, fim }) => `
          <li class="calendario-item">
            <div class="calendario-item__data">
              <span class="calendario-item__dia">${String(item.dia).padStart(2, '0')}</span>
              <span class="calendario-item__mes">${NOMES_MESES[item.mes - 1].slice(0, 3)}</span>
            </div>
            <div class="calendario-item__texto">
              <h3>${item.titulo}</h3>
              <p class="calendario-item__periodo">${textoPeriodo(item)} ${textoContagem(inicio, fim, hoje)}</p>
              ${item.descricao ? `<p class="calendario-item__descricao">${item.descricao}</p>` : ''}
            </div>
          </li>
        `
          )
          .join('')}
      </ul>
    </section>
  `;
}

function renderCardEvento(evento) {
  return `
          <div class="card-evento">
            ${evento.imagemUrl ? `<img src="${evento.imagemUrl}" alt="${evento.titulo}" class="card-evento__imagem" loading="lazy" />` : ''}
            <div class="card-evento__conteudo">
              <h3>${evento.titulo}</h3>
              <p class="card-evento__data">${formatarDataEvento(evento.data)}</p>
              ${renderContagemRegressiva(evento.data)}
              ${evento.local ? `<p class="card-evento__local">📍 ${evento.local}</p>` : ''}
              ${renderBotaoLocalizacao(evento.local)}
              ${renderDetalhes(evento)}
              ${evento.link ? `<a href="${evento.link}" target="_blank" rel="noopener" class="card-evento__link">Saiba mais</a>` : ''}
            </div>
          </div>
        `;
}

/**
 * Página "Eventos / Calendário": primeiro os eventos (do Firestore), depois o
 * Calendário do Transporte. O calendário não depende da internet do Firestore,
 * então aparece mesmo se os eventos derem erro ou estiverem vazios.
 */
export async function renderEventos(container) {
  container.innerHTML = `
    <section class="eventos">
      <h2>Eventos para caminhoneiro</h2>
      <div id="eventos-conteudo"><p class="loading">Carregando eventos...</p></div>
    </section>
    ${renderCalendario()}
  `;

  const alvo = container.querySelector('#eventos-conteudo');

  let eventos;
  try {
    eventos = await comTimeout(buscarEventosAtivos());
  } catch (erro) {
    alvo.innerHTML = `
      <div class="erro-carregamento">
        <p class="erro">Não foi possível carregar os eventos agora. Tente novamente.</p>
        <button id="tentar-carregar-eventos" class="btn-secundario">🔄 Tentar de novo</button>
      </div>
    `;
    console.error(erro);
    const botao = alvo.querySelector('#tentar-carregar-eventos');
    if (botao) botao.addEventListener('click', () => renderEventos(container));
    return;
  }

  if (eventos.length === 0) {
    alvo.innerHTML = `<p class="vazio">Nenhum evento programado no momento. Volte em breve!</p>`;
    return;
  }

  alvo.innerHTML = `<div class="eventos-lista">${eventos.map(renderCardEvento).join('')}</div>`;
}
