import { buscarNoticiasAtivas } from '../services/noticias.service.js';
import { formatarDataEvento } from '../utils/formatters.js';

const POR_PAGINA = 10;

export async function renderNoticias(container) {
  container.innerHTML = `<p class="loading">Carregando notícias...</p>`;

  let todasNoticias;
  try {
    todasNoticias = await buscarNoticiasAtivas();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar as notícias agora. Tente novamente.</p>`;
    console.error(erro);
    return;
  }

  if (todasNoticias.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhuma notícia publicada ainda.</p>`;
    return;
  }

  let quantidadeVisivel = POR_PAGINA;

  function render() {
    const visiveis = todasNoticias.slice(0, quantidadeVisivel);
    const temMais = todasNoticias.length > quantidadeVisivel;

    container.innerHTML = `
      <section class="noticias">
        <div class="noticias-lista">
          ${visiveis.map(renderCardNoticia).join('')}
        </div>

        ${
          temMais
            ? `<button id="carregar-mais-noticias" class="noticias__carregar-mais">Ver mais 10 notícias</button>`
            : ''
        }
      </section>
    `;

    const botaoMais = container.querySelector('#carregar-mais-noticias');
    if (botaoMais) {
      botaoMais.addEventListener('click', () => {
        quantidadeVisivel += POR_PAGINA;
        render();
      });
    }
  }

  render();
}

function renderCardNoticia(noticia) {
  const ehPropria = Boolean(noticia.texto);
  const href = ehPropria ? `/noticia/${noticia.id}` : noticia.link;
  const alvoLink = ehPropria ? '' : 'target="_blank" rel="noopener"';

  return `
    <div class="card-noticia">
      ${noticia.imagemUrl ? `<img src="${noticia.imagemUrl}" alt="${noticia.titulo}" class="card-noticia__imagem" loading="lazy" />` : ''}
      <div class="card-noticia__conteudo">
        <p class="card-noticia__data">${formatarDataEvento(noticia.data)}${noticia.autor ? ` · Por ${noticia.autor}` : ''}</p>
        <h3>${noticia.titulo}</h3>
        <p class="card-noticia__resumo">${noticia.resumo ?? ''}</p>
        ${href ? `<a href="${href}" ${alvoLink} class="card-noticia__link">Ler mais</a>` : ''}
      </div>
    </div>
  `;
}