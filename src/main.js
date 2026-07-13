import { renderNavbar } from './components/navbar.js';
import { renderHome } from './pages/home.js';
import { renderResultados } from './pages/resultados.js';
import { renderCadastroEmpresa } from './pages/cadastro-empresa.js';
import { renderRelatorioCliques } from './pages/admin-relatorios.js';
import { renderEventos } from './pages/eventos.js';
import { renderAdmin } from './pages/admin.js';
import { renderNoticias } from './pages/noticias.js';
import { renderCaminhoes } from './pages/caminhoes.js';
import { renderCadastroCaminhao } from './pages/cadastro-caminhao.js';

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
  } else if (rota === 'eventos') {
    renderEventos(app);
  } else if (rota === 'admin') {
    renderAdmin(app);
  } else if (rota === 'noticias') {
    renderNoticias(app);
  } else if (rota === 'caminhoes') {
    renderCaminhoes(app);
  } else if (rota === 'cadastro-caminhao') {
    renderCadastroCaminhao(app);
  } else {
    app.innerHTML = '<p>Página não encontrada.</p>';
  }
}

renderNavbar();
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
