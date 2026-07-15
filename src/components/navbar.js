export function renderNavbar() {
  const el = document.getElementById('navbar');
  el.innerHTML = `
    <nav class="navbar">
      <a href="/" class="navbar__logo"><img src="/images/logo/Logo-tra.png" alt="TRA da Estrada" class="navbar__logo-img"></a>
      <div class="navbar__acoes">
        <a href="/cadastro-empresa" class="navbar__cta">Cadastrar minha empresa</a>
        <a href="/admin" class="navbar__admin" title="Área do admin">⚙️</a>
      </div>
    </nav>
  `;
}
