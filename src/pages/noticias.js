import { buscarNoticiasAtivas } from '../services/noticias.service.js';
import { formatarDataEvento } from '../utils/formatters.js';

const CATEGORIAS = [
  { id: '', label: '🌐 Todas' },
  { id: 'mobilizacao', label: '📢 Mobilização' },
  { id: 'rodovia', label: '🛣️ Rodovia' },
  { id: 'seguranca', label: '🚨 Segurança' },
  { id: 'direitos', label: '📋 Direitos' },
  { id: 'geral', label: '📰 Geral' },
];

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

  let categoriaAtiva = '';
  let quantidadeVisivel = POR_PAGINA;

  function render() {
    const filtradas = categoriaAtiva
      ? todasNoticias.filter((n) => n.categoria === categoriaAtiva)
      : todasNoticias;
    const visiveis = filtradas.slice(0, quantidadeVisivel);
    const temMais = filtradas.length > quantidadeVisivel;

    container.innerHTML = `
      <section class="noticias">
        <div class="noticias__header">
          <h1>📰 Notícias que impactam o seu bolso</h1>
          <p>Separadas por perfil: autônomo, CLT e agregado</p>
        </div>

        <div class="noticias__filtros">
          ${CATEGORIAS.map(
            (c) =>
              `<button class="chip ${categoriaAtiva === c.id ? 'chip--ativo' : ''}" data-categoria="${c.id}">${c.label}</button>`
          ).join('')}
        </div>

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

    container.querySelectorAll('.noticias__filtros .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        categoriaAtiva = chip.dataset.categoria;
        quantidadeVisivel = POR_PAGINA;
        render();
      });
    });

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