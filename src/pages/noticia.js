import { buscarNoticiaPorId } from '../services/noticias.service.js';

const TAG_CATEGORIA = {
  mobilizacao: 'Mobilização',
  rodovia: 'Rodovia',
  seguranca: 'Segurança',
  direitos: 'Direitos',
  geral: 'Geral',
  autonomo: 'Autônomo',
  clt: 'CLT',
  agregado: 'Agregado',
};

function formatarDataBR(dataStr) {
  if (!dataStr) return '';
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

export async function renderNoticiaCompleta(container, id) {
  container.innerHTML = `<p class="loading">Carregando notícia...</p>`;

  let noticia;
  try {
    noticia = await buscarNoticiaPorId(id);
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar essa notícia agora. Tente novamente.</p>`;
    console.error(erro);
    return;
  }

  if (!noticia) {
    container.innerHTML = `
      <div class="noticia-completa">
        <a href="/noticias" class="noticia-completa__voltar">← Voltar para notícias</a>
        <p class="vazio">Notícia não encontrada.</p>
      </div>
    `;
    return;
  }

  // Cada parágrafo do texto vira um <p> separado (quebra de linha dupla = novo parágrafo).
  const paragrafos = (noticia.texto || '')
    .split(/\n\s*\n/)
    .filter(Boolean)
    .map((p) => `<p>${p.trim()}</p>`)
    .join('');

  container.innerHTML = `
    <div class="noticia-completa">
      <a href="/noticias" class="noticia-completa__voltar">← Voltar para notícias</a>
      ${
        noticia.imagemUrl
          ? `<img src="${noticia.imagemUrl}" alt="${noticia.titulo}" class="noticia-completa__imagem" />`
          : ''
      }
      <span class="noticia-completa__tag">#${TAG_CATEGORIA[noticia.categoria] || 'Geral'}</span>
      <h1 class="noticia-completa__titulo">${noticia.titulo}</h1>
      <p class="noticia-completa__meta">📅 ${formatarDataBR(noticia.data)}${noticia.autor ? ` · Por ${noticia.autor}` : ''}</p>
      <div class="noticia-completa__texto">${paragrafos}</div>
    </div>
  `;
}