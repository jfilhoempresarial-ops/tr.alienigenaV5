import { CATEGORIAS } from '../pages/home.js';

const LINKS_MENU = [
  { href: '/', label: 'Home' },
  { href: '/noticias', label: 'Notícias' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/fretes', label: 'Fretes' },
  { href: '/eventos', label: 'Eventos' },
  { href: 'https://www.aragaocaminhoes.com.br/', label: 'Vendas de Caminhões' },
  { href: '/empresas-parceiras', label: 'Empresas Parceiras' },
  { href: 'https://digital.sestsenat.org.br/cursos?area=63&page=1', label: 'Cursos' },
  { href: '/grupos-whatsapp', label: 'Grupos de WhatsApp' },
  { href: '/credito-tra', label: 'Crédito TRA' },
  { href: '/ranking', label: 'Ranking das Empresas' },
  // Itens que aparecem só no menu lateral (não entram na barra horizontal do desktop).
  { href: '#', label: 'Toxicológico', apenasMenuLateral: true },
  { href: 'https://lojadoalienigena.com.br', label: 'Loja do Motorista', apenasMenuLateral: true, externo: true },
  { href: 'https://www.youtube.com/@TRAlienígena', label: 'Programa A Voz do Motorista', apenasMenuLateral: true, externo: true },
];

export function renderNavbar() {
  const el = document.getElementById('navbar');
  el.innerHTML = `
    <nav class="navbar">
      <button class="navbar__hamburguer" id="navbar-hamburguer" aria-label="Abrir menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <a href="/" class="navbar__logo navbar__logo--centro"><img src="/images/logo-tra.png" alt="TRA Soluções pro Motorista" class="navbar__logo-img navbar__logo-img--grande"></a>
      <nav class="navbar__links-desktop">
        ${LINKS_MENU.filter((link) => !link.apenasMenuLateral)
          .map((link, i) =>
            // "Serviços" entra logo depois de "Home"
            (i === 1 ? renderServicosDesktop() : '') +
            `<a href="${link.href}" class="navbar__link-desktop">${link.label}</a>`
          )
          .join('')}
      </nav>
      <div class="navbar__acoes">
        <a href="/admin" class="navbar__admin" title="Área do admin">⚙️</a>
      </div>
    </nav>

    <div class="menu-lateral__overlay" id="menu-lateral-overlay"></div>
    <aside class="menu-lateral" id="menu-lateral">
      <div class="menu-lateral__header">
        <img src="/images/logo-tra.png" alt="TRA Soluções pro Motorista" class="menu-lateral__logo" />
        <button class="menu-lateral__fechar" id="menu-lateral-fechar" aria-label="Fechar menu">✕</button>
      </div>
      <nav class="menu-lateral__links">
        ${LINKS_MENU.map(
          (link, i) =>
            (i === 1 ? renderServicosLateral() : '') +
            `<a href="${link.href}" ${link.externo ? 'target="_blank" rel="noopener"' : ''} class="menu-lateral__link">${link.label}</a>`
        ).join('')}
      </nav>
    </aside>
  `;

  configurarMenuLateral(el);
  configurarServicosDesktop(el);
}

// ---------------------------------------------------------------------------
// Menu "Serviços": as mesmas categorias dos botões da Home (lista CATEGORIAS
// do home.js). Categoria nova nos botões aparece aqui sozinha.
// ---------------------------------------------------------------------------
function linkDaCategoria(cat) {
  return cat.externo ?? cat.rotaInterna ?? `/${cat.id}`;
}

function atributosExterno(cat) {
  return cat.externo ? 'target="_blank" rel="noopener"' : '';
}

function renderServicosDesktop() {
  return `
    <div class="navbar__dropdown" id="navbar-servicos">
      <button type="button" class="navbar__link-desktop navbar__dropdown-botao" aria-expanded="false" aria-haspopup="true">
        Serviços <span class="navbar__dropdown-seta" aria-hidden="true">▾</span>
      </button>
      <div class="navbar__dropdown-menu" role="menu">
        ${CATEGORIAS.map(
          (cat) => `
          <a href="${linkDaCategoria(cat)}" ${atributosExterno(cat)} class="navbar__dropdown-item" role="menuitem">
            ${cat.label}
          </a>`
        ).join('')}
      </div>
    </div>
  `;
}

function renderServicosLateral() {
  return `
    <details class="menu-lateral__grupo">
      <summary class="menu-lateral__grupo-titulo">Serviços</summary>
      <div class="menu-lateral__grupo-itens">
        ${CATEGORIAS.map(
          (cat) => `
          <a href="${linkDaCategoria(cat)}" ${atributosExterno(cat)} class="menu-lateral__link menu-lateral__sublink">
            ${cat.label}
          </a>`
        ).join('')}
      </div>
    </details>
  `;
}

function configurarServicosDesktop(el) {
  const dropdown = el.querySelector('#navbar-servicos');
  if (!dropdown) return;
  const botao = dropdown.querySelector('.navbar__dropdown-botao');

  function abrir(aberto) {
    dropdown.classList.toggle('navbar__dropdown--aberto', aberto);
    botao.setAttribute('aria-expanded', String(aberto));
  }

  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    abrir(!dropdown.classList.contains('navbar__dropdown--aberto'));
  });
  dropdown.querySelectorAll('.navbar__dropdown-item').forEach((item) =>
    item.addEventListener('click', () => abrir(false))
  );
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) abrir(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') abrir(false);
  });
}

function configurarMenuLateral(el) {
  const hamburguer = el.querySelector('#navbar-hamburguer');
  const menu = document.getElementById('menu-lateral');
  const overlay = document.getElementById('menu-lateral-overlay');
  const fechar = document.getElementById('menu-lateral-fechar');

  function abrirMenu() {
    menu.classList.add('menu-lateral--aberto');
    overlay.classList.add('menu-lateral__overlay--visivel');
  }

  function fecharMenu() {
    menu.classList.remove('menu-lateral--aberto');
    overlay.classList.remove('menu-lateral__overlay--visivel');
  }

  hamburguer.addEventListener('click', abrirMenu);
  fechar.addEventListener('click', fecharMenu);
  overlay.addEventListener('click', fecharMenu);

  menu.querySelectorAll('.menu-lateral__link').forEach((link) => {
    link.addEventListener('click', fecharMenu);
  });
}
