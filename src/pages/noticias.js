import { buscarNoticiasAtivas } from '../services/noticias.service.js';
import { formatarDataEvento } from '../utils/formatters.js';

export async function renderNoticias(container) {
  container.innerHTML = `<p class="loading">Carregando notícias...</p>`;

  const noticias = await buscarNoticiasAtivas();

  if (noticias.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhuma notícia publicada ainda.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="noticias">
      <h2>Notícias</h2>
      <div class="noticias-lista">
        ${noticias
          .map(
            (noticia) => `
          <div class="card-noticia">
            ${noticia.imagemUrl ? `<img src="${noticia.imagemUrl}" alt="${noticia.titulo}" class="card-noticia__imagem" loading="lazy" />` : ''}
            <div class="card-noticia__conteudo">
              <p class="card-noticia__data">${formatarDataEvento(noticia.data)}</p>
              <h3>${noticia.titulo}</h3>
              <p class="card-noticia__resumo">${noticia.resumo ?? ''}</p>
              ${noticia.link ? `<a href="${noticia.link}" target="_blank" rel="noopener" class="card-noticia__link">Ler mais</a>` : ''}
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    </section>
  `;
}
