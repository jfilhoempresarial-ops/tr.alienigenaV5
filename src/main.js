import { renderNavbar } from './components/navbar.js';
import { renderHome } from './pages/home.js';
import { renderResultados } from './pages/resultados.js';
import { renderCadastroEmpresa } from './pages/cadastro-empresa.js';
import { renderRelatorioCliques } from './pages/admin-relatorios.js';

const app = document.getElementById('app');

function router() {
  const hash = window.location.hash.slice(1) || '/';
  const [, rota, param] = hash.split('/');

  if (!rota) {
    renderHome(app);
  } else if (rota === 'resultados' && param) {
    renderResultados(app, param);
  } else if (rota === 'cadastro-empresa') {
    renderCadastroEmpresa(app);
  } else if (rota === 'admin-relatorios') {
    renderRelatorioCliques(app);
  } else {
    app.innerHTML = '<p>Página não encontrada.</p>';
  }
}

renderNavbar();
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
