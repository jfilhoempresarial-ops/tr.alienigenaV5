import { buscarEventosAtivos } from '../services/eventos.service.js';
import { formatarDataEvento } from '../utils/formatters.js';

export async function renderEventos(container) {
  container.innerHTML = `<p class="loading">Carregando eventos...</p>`;

  const eventos = await buscarEventosAtivos();

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
