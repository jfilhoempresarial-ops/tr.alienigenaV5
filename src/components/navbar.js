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

// Mesmas categorias/subcategorias dos botões da home (src/pages/home.js), pra
// quem preferir navegar pelo menu em vez de rolar os botões da tela inicial.
// Os links seguem o mesmo padrão de rota usado lá: /<id-da-categoria>.
// Em ordem alfabética (pelo label), pra facilitar achar no menu.
// "Truck Fest" fica de fora daqui de propósito (é um evento, já tem o link
// "Eventos" no menu principal) — se quiser incluir, é só adicionar na lista.
const CATEGORIAS_SERVICOS = [
  { id: 'autopecas', label: 'Auto Peças' },
  { id: 'borracharia', label: 'Borracharia' },
  { id: 'eletrica', label: 'Elétrica' },
  { id: 'guincho', label: 'Guincho/Socorro' },
  { id: 'lavajato', label: 'Lava-Jato' },
  { id: 'mecanico', label: 'Mecânicos' },
  { id: 'financiamento', label: 'Outros Serviços' },
  { id: 'posto', label: 'Posto/Conveniência' },
  { id: 'pontoapoio', label: 'PPDs ANTT' },
  { id: 'tacografo', label: 'Tacógrafo' },
];

function renderLinkDesktop(link) {
  return `<a href="${link.href}" class="navbar__link-desktop">${link.label}</a>`;
}

function renderServicosDropdownDesktop() {
  return `
    <div class="navbar__servicos" id="navbar-servicos">
      <button type="button" class="navbar__link-desktop navbar__servicos-trigger" id="servicos-trigger" style="background:none; border:none; padding:0; cursor:pointer; font-family:inherit; color:inherit; display:inline-flex; align-items:center; gap:4px;">
        Serviços <span id="servicos-seta" style="font-size:0.7em; transition: transform 0.15s;">▾</span>
      </button>
      <div class="navbar__servicos-dropdown" id="servicos-dropdown" style="display:none; position:absolute; top:100%; left:0; background:#fff; border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,0.15); padding:8px 0; min-width:220px; z-index:1000;">
        ${CATEGORIAS_SERVICOS.map(
          (cat) =>
            `<a href="/${cat.id}" class="navbar__servicos-dropdown-link" style="display:block; padding:9px 18px; color:#222; text-decoration:none; white-space:nowrap; font-size:0.92em; border-bottom:1px solid rgba(0,0,0,0.06);">${cat.label}</a>`
        ).join('')}
      </div>
    </div>
  `;
}

function renderServicosLateral() {
  return `
    <div class="menu-lateral__servicos" id="menu-lateral-servicos">
      <button type="button" class="menu-lateral__link menu-lateral__servicos-toggle" id="servicos-toggle-lateral" style="background:none; border:none; padding:0; width:100%; text-align:left; cursor:pointer; font-family:inherit; color:inherit; display:flex; justify-content:space-between; align-items:center;">
        Serviços <span id="servicos-seta-lateral" style="font-size:0.8em; transition: transform 0.15s;">▾</span>
      </button>
      <div class="menu-lateral__servicos-lista" id="servicos-lista-lateral" style="display:none; padding:6px 0 10px 20px; border-left:2px solid rgba(255,255,255,0.15); margin-left:2px;">
        ${CATEGORIAS_SERVICOS.map(
          (cat) =>
            `<a href="/${cat.id}" class="menu-lateral__link menu-lateral__servicos-item" style="display:block; width:100%; font-size:0.82em; padding:9px 0; opacity:0.78; border-bottom:1px solid rgba(255,255,255,0.06);">– ${cat.label}</a>`
        ).join('')}
      </div>
    </div>
  `;
}

export function renderNavbar() {
  const el = document.getElementById('navbar');

  const linksDesktopVisiveis = LINKS_MENU.filter((link) => !link.apenasMenuLateral);
  const [primeiroLinkDesktop, ...restanteLinksDesktop] = linksDesktopVisiveis;

  el.innerHTML = `
    <nav class="navbar">
      <button class="navbar__hamburguer" id="navbar-hamburguer" aria-label="Abrir menu">
        <span></span>
        <span></span>
        <span></span>
      </button>
      <a href="/" class="navbar__logo navbar__logo--centro"><img src="/images/logo-tra.png" alt="TRA Soluções pro Motorista" class="navbar__logo-img navbar__logo-img--grande"></a>
      <nav class="navbar__links-desktop" style="position:relative;">
        ${renderLinkDesktop(primeiroLinkDesktop)}
        ${renderServicosDropdownDesktop()}
        ${restanteLinksDesktop.map(renderLinkDesktop).join('')}
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
        <a href="${primeiroLinkDesktop.href}" class="menu-lateral__link">${primeiroLinkDesktop.label}</a>
        ${renderServicosLateral()}
        ${LINKS_MENU.slice(1)
          .map(
            (link) =>
              `<a href="${link.href}" ${link.externo ? 'target="_blank" rel="noopener"' : ''} class="menu-lateral__link">${link.label}</a>`
          )
          .join('')}
      </nav>
    </aside>
  `;

  configurarMenuLateral(el);
  configurarServicosDropdown(el);
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

  // Só os links de verdade fecham o menu lateral inteiro ao clicar — o botão
  // "Serviços" (que só abre/fecha a lista de subcategorias) fica de fora
  // porque ele tem sua própria classe (menu-lateral__servicos-toggle) e não
  // entra nesse seletor.
  menu.querySelectorAll('.menu-lateral__link:not(.menu-lateral__servicos-toggle)').forEach((link) => {
    link.addEventListener('click', fecharMenu);
  });
}

/** Controla o dropdown "Serviços" da barra desktop e a lista expansível do menu lateral (mobile). */
function configurarServicosDropdown(el) {
  // --- Desktop: dropdown que abre/fecha ao clicar no botão ---
  const trigger = el.querySelector('#servicos-trigger');
  const dropdown = el.querySelector('#servicos-dropdown');
  const seta = el.querySelector('#servicos-seta');

  if (trigger && dropdown) {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const aberto = dropdown.style.display === 'block';
      dropdown.style.display = aberto ? 'none' : 'block';
      if (seta) seta.style.transform = aberto ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    // Fecha o dropdown se a pessoa clicar em qualquer outro lugar da página.
    document.addEventListener('click', (event) => {
      if (!dropdown.contains(event.target) && event.target !== trigger) {
        dropdown.style.display = 'none';
        if (seta) seta.style.transform = 'rotate(0deg)';
      }
    });
  }

  // --- Mobile (menu lateral): expande/recolhe a lista de subcategorias ---
  const toggleLateral = document.getElementById('servicos-toggle-lateral');
  const listaLateral = document.getElementById('servicos-lista-lateral');
  const setaLateral = document.getElementById('servicos-seta-lateral');

  if (toggleLateral && listaLateral) {
    toggleLateral.addEventListener('click', () => {
      const aberto = listaLateral.style.display === 'block';
      listaLateral.style.display = aberto ? 'none' : 'block';
      if (setaLateral) setaLateral.style.transform = aberto ? 'rotate(0deg)' : 'rotate(180deg)';
    });
  }
}
