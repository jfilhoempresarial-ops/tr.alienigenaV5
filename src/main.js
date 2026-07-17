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
import { renderBusca } from './pages/busca.js';
import { renderGruposWhatsapp } from './pages/grupos-whatsapp.js';
import { renderFretes } from './pages/fretes.js';
import { renderAniversariantesMes } from './pages/aniversariantes-mes.js';
import { renderFooter, renderWhatsappFloat } from './components/footer.js';

const app = document.getElementById('app');

const ROTAS_FIXAS = {
  'cadastro-empresa': renderCadastroEmpresa,
  'admin-relatorios': renderRelatorioCliques,
  eventos: renderEventos,
  admin: renderAdmin,
  noticias: renderNoticias,
  caminhoes: renderCaminhoes,
  'cadastro-caminhao': renderCadastroCaminhao,
  vagas: renderVagas,
  'grupos-whatsapp': renderGruposWhatsapp,
  'aniversariantes-mes': renderAniversariantesMes,
};

function router() {
  const caminho = window.location.pathname.replace(/^\/+|\/+$/g, '');
  const [rota] = caminho.split('/');
  const params = new URLSearchParams(window.location.search);

  window.scrollTo(0, 0);

  if (!rota) {
    renderHome(app);
  } else if (rota === 'busca') {
  renderBusca(app, params.get('q') || '');
} else if (rota === 'fretes') {
  renderFretes(app, params.get('estado'));
} else if (ROTAS_FIXAS[rota]) {
    ROTAS_FIXAS[rota](app);
  } else {
    renderResultados(app, rota);
  }
}

document.addEventListener('click', (e) => {
  const link = e.target.closest('a');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href || !href.startsWith('/') || href.startsWith('//')) return;
  if (link.target === '_blank' || link.hasAttribute('download')) return;

  e.preventDefault();
  if (href !== window.location.pathname + window.location.search) {
    window.history.pushState({}, '', href);
    router();
  }
});

window.addEventListener('popstate', router);

renderNavbar();
renderFooter();
renderWhatsappFloat();
router();
