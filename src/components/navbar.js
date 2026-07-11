export function renderNavbar() {
  const el = document.getElementById('navbar');
  el.innerHTML = `
    <nav class="navbar">
      <a href="#/" class="navbar__logo">TRA da Estrada</a>
      <a href="#/cadastro-empresa" class="navbar__cta">Cadastrar minha empresa</a>
    </nav>
  `;
}
