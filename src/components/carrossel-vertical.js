import { buscarBannersPorCategoria, registrarClique } from '../services/banners.service.js';

const NUMERO_COMERCIAL = '5588988621481'; // mesmo número usado no carrossel de categoria

export async function renderCarrosselVertical(containerId, categoria) {
  const container = document.getElementById(containerId);
  if (!container) return;

  let banners = [];
  try {
    banners = await buscarBannersPorCategoria(categoria);
  } catch (erro) {
    console.error('Erro ao buscar banners verticais:', erro);
  }

  if (banners.length === 0) {
    container.innerHTML = renderPlaceholders();
    return;
  }

  container.innerHTML = banners
    .map(
      (banner, i) => `
    <a
      href="${banner.link}"
      target="_blank"
      rel="noopener sponsored"
      class="banner-vertical"
      style="background-image: url('${banner.imagemUrl}')"
      data-indice="${i}"
    >
      <span class="banner-vertical__overlay"></span>
    </a>
  `
    )
    .join('');

  container.querySelectorAll('.banner-vertical').forEach((el, i) => {
    el.addEventListener('click', () => registrarClique(banners[i].id, banners[i].empresaNome));
  });
}

function renderPlaceholders() {
  const texto = encodeURIComponent('Quero anunciar minha empresa no TRA da Estrada');
  return Array.from({ length: 2 })
    .map(
      () => `
    <a
      href="https://wa.me/${NUMERO_COMERCIAL}?text=${texto}"
      target="_blank"
      rel="noopener"
      class="banner-vertical banner-vertical--placeholder"
    >
      <span class="banner-vertical__tag">ESPAÇO PUBLICITÁRIO</span>
      <span class="banner-vertical__titulo">Anuncie aqui</span>
    </a>
  `
    )
    .join('');
}
