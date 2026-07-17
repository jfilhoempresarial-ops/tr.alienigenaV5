import { buscarBannersAtivos, buscarBannersPorCategoria, registrarClique } from '../services/banners.service.js';

const INTERVALO_MS = 3000;
let timerAtual = null;

const NUMERO_COMERCIAL = '5588988621481'; // TODO: troque pelo seu número real de WhatsApp comercial

// Texto customizado do placeholder por categoria. Categorias que não estão
// aqui caem no texto genérico "Alcance motoristas de {categoria} na sua região".
const PLACEHOLDER_TEXTO = {
  eventos: {
    titulo: 'Divulgue seu evento aqui',
    sub: 'Alcance motoristas de toda a região',
  },
};

export async function renderCarrosselBanners(containerId = 'carrossel-banners', categoria = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (timerAtual) {
    clearInterval(timerAtual);
    timerAtual = null;
  }

  let banners;
  try {
    banners = categoria ? await buscarBannersPorCategoria(categoria) : await buscarBannersAtivos();
  } catch (erro) {
    console.error('Erro ao buscar banners:', erro);
    banners = [];
  }

  if (banners.length === 0) {
    if (categoria) {
      renderPlaceholder(container, categoria);
    } else {
      container.innerHTML = '';
    }
    return;
  }

  let indiceAtual = 0;

  container.innerHTML = `
    <div class="carrossel">
      ${banners
        .map(
          (banner, i) => `
        
          <a
          href="${banner.link}"
          target="_blank"
          rel="noopener sponsored"
          class="carrossel__slide ${i === 0 ? 'carrossel__slide--ativo' : ''}"
          data-indice="${i}"
        >
          <img src="${banner.imagemUrl}" alt="${banner.empresaNome}" loading="lazy" />
        </a>
      `
        )
        .join('')}
      <div class="carrossel__dots">
        ${banners.map((_, i) => `<span class="carrossel__dot ${i === 0 ? 'carrossel__dot--ativo' : ''}"></span>`).join('')}
      </div>
    </div>
  `;

  const slides = container.querySelectorAll('.carrossel__slide');
  const dots = container.querySelectorAll('.carrossel__dot');

  slides.forEach((slide, i) => {
    slide.addEventListener('click', () => {
      registrarClique(banners[i].id, banners[i].empresaNome);
    });
  });

  function mostrarSlide(indice) {
    slides.forEach((slide, i) => slide.classList.toggle('carrossel__slide--ativo', i === indice));
    dots.forEach((dot, i) => dot.classList.toggle('carrossel__dot--ativo', i === indice));
    indiceAtual = indice;
  }

  timerAtual = setInterval(() => {
    const proximo = (indiceAtual + 1) % banners.length;
    mostrarSlide(proximo);
  }, INTERVALO_MS);
}

function renderPlaceholder(container, categoria) {
  const textoCustom = PLACEHOLDER_TEXTO[categoria];
  const titulo = textoCustom ? textoCustom.titulo : 'Sua empresa aqui';
  const sub = textoCustom ? textoCustom.sub : `Alcance motoristas de ${categoria} na sua região`;

  container.innerHTML = `
    
      <a
      href="https://wa.me/${NUMERO_COMERCIAL}?text=${encodeURIComponent('Quero anunciar minha empresa no TRA da Estrada')}"
      target="_blank"
      rel="noopener"
      class="carrossel-placeholder"
    >
      <span class="carrossel-placeholder__tag">ESPAÇO PUBLICITÁRIO</span>
      <span class="carrossel-placeholder__titulo">${titulo}</span>
      <span class="carrossel-placeholder__sub">${sub}</span>
    </a>
  `;
}