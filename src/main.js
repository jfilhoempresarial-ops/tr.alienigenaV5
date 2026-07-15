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
import { renderVagas } from './pages/vagas.js';

const app = document.getElementById('app');

// Rotas fixas do site (tudo que NÃO é uma categoria de prestador).
const ROTAS_FIXAS = {
  'cadastro-empresa': renderCadastroEmpresa,
  'admin-relatorios': renderRelatorioCliques,
  eventos: renderEventos,
  admin: renderAdmin,
  noticias: renderNoticias,
  caminhoes: renderCaminhoes,
  'cadastro-caminhao': renderCadastroCaminhao,
  vagas: renderVagas,
};

function router() {
  const caminho = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const [rota] = caminho.split('/');

  window.scrollTo(0, 0);

  if (!rota) {
    renderHome(app);
  } else if (ROTAS_FIXAS[rota]) {
    ROTAS_FIXAS[rota](app);
  } else {
    // Qualquer outro endereço de um segmento (ex: /mecanico, /posto)
    // é tratado como categoria de prestador de serviço.
    renderResultados(app, rota);
  }
}

// Intercepta cliques em links internos (começando com "/") para navegar
// sem recarregar a página inteira, usando a History API do navegador.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;

  e.preventDefault();
  if (href !== window.location.pathname) {
    window.history.pushState({}, '', href);
    router();
  }
});

// Suporte ao botão "voltar/avançar" do navegador.
window.addEventListener('popstate', router);

renderNavbar();
router();
