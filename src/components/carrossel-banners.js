import { buscarBannersAtivos, buscarBannersPorCategoria, registrarClique } from '../services/banners.service.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';

// Intervalo base + uma variação de até alguns segundos, calculada por
// carrossel (containerId), pra cada um trocar de slide num compasso levemente
// diferente e não ficarem todos passando no mesmo instante.
const INTERVALO_BASE_MS = 3000;
const VARIACAO_MAXIMA_MS = 1800;

// Timers guardados por containerId (não mais uma única variável global) —
// assim, renderizar um carrossel novo só limpa o timer DELE MESMO, nunca o
// de outro carrossel na mesma página. Esse era o bug: antes, um único
// "timerAtual" compartilhado fazia os carrosséis limparem o timer um do
// outro, deixando o comportamento de troca de slide imprevisível.
const timersPorContainer = new Map();

const NUMERO_COMERCIAL = '5588988621481'; // TODO: troque pelo seu número real de WhatsApp comercial

/**
 * Gera o link do banner: se o documento tiver o campo "whatsapp" (só o número,
 * com DDI+DDD, ex: "5588994371661"), monta o link do WhatsApp já com uma
 * mensagem pronta. Senão, usa o campo "link" normalmente (site, Instagram, etc).
 */
function gerarHrefBanner(banner) {
  if (banner.whatsapp) {
    return gerarLinkWhatsapp(
      banner.whatsapp,
      `Olá! Vi o anúncio da ${banner.empresaNome} no TRA da Estrada e quero saber mais.`
    );
  }
  return banner.link;
}

// Texto customizado do placeholder por categoria. Categorias que não estão
// aqui caem no texto genérico "Alcance motoristas de {categoria} na sua região".
const PLACEHOLDER_TEXTO = {
  eventos: {
    titulo: 'Divulgue seu evento aqui',
    sub: 'Alcance motoristas de toda a região',
  },
};

/** Gera um intervalo determinístico (mas diferente) por containerId, entre
 * INTERVALO_BASE_MS e INTERVALO_BASE_MS + VARIACAO_MAXIMA_MS. Determinístico
 * pra não ficar um valor aleatório novo a cada re-render do mesmo carrossel. */
function calcularIntervalo(containerId) {
  let hash = 0;
  for (let i = 0; i < containerId.length; i++) {
    hash = (hash * 31 + containerId.charCodeAt(i)) % 100000;
  }
  const variacao = hash % VARIACAO_MAXIMA_MS;
  return INTERVALO_BASE_MS + variacao;
}

export async function renderCarrosselBanners(containerId = 'carrossel-banners', categoria = null) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const timerAnterior = timersPorContainer.get(containerId);
  if (timerAnterior) {
    clearInterval(timerAnterior);
    timersPorContainer.delete(containerId);
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
          href="${gerarHrefBanner(banner)}"
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

  const intervaloDesteCarrossel = calcularIntervalo(containerId);
  const novoTimer = setInterval(() => {
    const proximo = (indiceAtual + 1) % banners.length;
    mostrarSlide(proximo);
  }, intervaloDesteCarrossel);

  timersPorContainer.set(containerId, novoTimer);
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