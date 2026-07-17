const LINKS_MENU = [
  { href: '/', label: 'Home' },
  { href: '/noticias', label: 'Notícias' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/fretes', label: 'Fretes' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/caminhoes', label: 'Caminhões' },
  { href: '/empresas-parceiras', label: 'Empresas Parceiras' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/grupos-whatsapp', label: 'Grupos de WhatsApp' },
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
      <a href="/" class="navbar__logo"><img src="/images/logo/Logo-tra.png" alt="TRA da Estrada" class="navbar__logo-img"></a>
      <div class="navbar__acoes">
        <a href="/cadastro-empresa" class="navbar__cta">Cadastrar minha empresa</a>
        <a href="/admin" class="navbar__admin" title="Área do admin">⚙️</a>
      </div>
    </nav>

    <div class="menu-lateral__overlay" id="menu-lateral-overlay"></div>
    <aside class="menu-lateral" id="menu-lateral">
      <div class="menu-lateral__header">
        <img src="/images/logo/Logo-tra.png" alt="TRA da Estrada" class="menu-lateral__logo" />
        <button class="menu-lateral__fechar" id="menu-lateral-fechar" aria-label="Fechar menu">✕</button>
      </div>
      <nav class="menu-lateral__links">
        ${LINKS_MENU.map((link) => `<a href="${link.href}" class="menu-lateral__link">${link.label}</a>`).join('')}
      </nav>
    </aside>
  `;

  configurarMenuLateral(el);
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
