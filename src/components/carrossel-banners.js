import { buscarBannersAtivos } from '../services/banners.service.js';

const INTERVALO_MS = 3000;
let timerAtual = null;

export async function renderCarrosselBanners() {
  const container = document.getElementById('carrossel-banners');
  if (!container) return;

  if (timerAtual) {
    clearInterval(timerAtual);
    timerAtual = null;
  }

  const banners = await buscarBannersAtivos();

  if (banners.length === 0) {
    container.innerHTML = '';
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
