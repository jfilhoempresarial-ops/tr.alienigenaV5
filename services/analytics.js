/**
 * GOOGLE ANALYTICS 4 (GA4) — estatísticas do site
 *
 * O que é contado:
 *   - page_view ........ cada página vista (o site troca de página sem
 *                        recarregar, então o main.js avisa a cada troca)
 *   - search ........... cada busca feita na página /busca (termo pesquisado)
 *   - clique_whatsapp .. cada clique em botão de WhatsApp (com o nome da
 *                        empresa, quando o clique é no card de uma empresa)
 *   - clique_ligar ..... cada clique em "Ligar" (telefone fixo)
 *   - clique_banner .... cada clique em banner (com o nome da empresa)
 *
 * IMPORTANTE no painel do Analytics: deixe a "Métrica otimizada" DESLIGADA
 * (Administrador → Fluxos de dados → TraV5). As trocas de página já são
 * contadas aqui; se ligar, as visualizações podem ser contadas em dobro.
 *
 * LGPD: mostra um aviso de cookies no primeiro acesso. Quem clicar em
 * "Recusar" não é contado com cookies (o Google só recebe um sinal
 * anônimo, sem identificar a pessoa). A escolha fica guardada no aparelho.
 */

const ID_ANALYTICS = 'G-SWD7JDKVNM';
const CHAVE_ESCOLHA = 'tra-cookies-escolha'; // 'aceito' | 'recusado'

let carregado = false;

function lerEscolha() {
  try {
    return localStorage.getItem(CHAVE_ESCOLHA);
  } catch {
    return null;
  }
}

function salvarEscolha(valor) {
  try {
    localStorage.setItem(CHAVE_ESCOLHA, valor);
  } catch {
    // navegador sem armazenamento: vale só nesta visita
  }
}

function gtag() {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Carrega o Analytics. Chamar uma vez, no início (main.js). */
export function iniciarAnalytics() {
  if (carregado || typeof window === 'undefined') return;
  carregado = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = gtag;

  const escolha = lerEscolha();
  gtag('consent', 'default', {
    analytics_storage: escolha === 'recusado' ? 'denied' : 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${ID_ANALYTICS}`;
  document.head.appendChild(script);

  gtag('js', new Date());
  // send_page_view: false → as páginas são avisadas por registrarPagina()
  gtag('config', ID_ANALYTICS, { send_page_view: false });

  ouvirCliques();
  if (!escolha) mostrarAvisoCookies();
}

/** Avisa o Analytics que uma página foi aberta (chamado pelo router). */
export function registrarPagina() {
  if (!carregado) return;
  gtag('event', 'page_view', {
    page_location: window.location.href,
    page_path: window.location.pathname + window.location.search,
    page_title: document.title,
  });
}

/** Evento livre, ex.: registrarEvento('search', { search_term: 'borracharia' }) */
export function registrarEvento(nome, parametros = {}) {
  if (!carregado) return;
  gtag('event', nome, parametros);
}

// ---------------------------------------------------------------------------
// Cliques em WhatsApp e "Ligar" em qualquer lugar do site
// ---------------------------------------------------------------------------
function nomeDaEmpresaPerto(elemento) {
  const card = elemento.closest('.card-empresa, .mini-card, .nova-empresa-card, article, li');
  const titulo = card?.querySelector('h2, h3, h4, strong, .card-empresa__nome');
  return (titulo?.textContent || '').trim().slice(0, 100);
}

function ouvirCliques() {
  document.addEventListener(
    'click',
    (e) => {
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      const pagina = window.location.pathname;

      if (href.includes('wa.me/') || href.includes('api.whatsapp.com') || href.includes('chat.whatsapp.com')) {
        registrarEvento('clique_whatsapp', {
          empresa: nomeDaEmpresaPerto(link) || '(sem empresa)',
          tipo: href.includes('chat.whatsapp.com') ? 'grupo' : 'conversa',
          pagina,
        });
      } else if (href.startsWith('tel:')) {
        registrarEvento('clique_ligar', { empresa: nomeDaEmpresaPerto(link) || '(sem empresa)', pagina });
      }
    },
    true
  );
}

// ---------------------------------------------------------------------------
// Aviso de cookies (LGPD)
// ---------------------------------------------------------------------------
function mostrarAvisoCookies() {
  const aviso = document.createElement('div');
  aviso.className = 'aviso-cookies';
  aviso.setAttribute('role', 'dialog');
  aviso.setAttribute('aria-label', 'Aviso de cookies');
  aviso.innerHTML = `
    <p class="aviso-cookies__texto">
      Usamos cookies para entender como o site é usado e melhorar o conteúdo para os motoristas.
      Não vendemos seus dados.
    </p>
    <div class="aviso-cookies__botoes">
      <button type="button" class="aviso-cookies__recusar">Recusar</button>
      <button type="button" class="aviso-cookies__aceitar">Aceitar</button>
    </div>
  `;
  document.body.appendChild(aviso);

  aviso.querySelector('.aviso-cookies__aceitar').addEventListener('click', () => {
    salvarEscolha('aceito');
    gtag('consent', 'update', { analytics_storage: 'granted' });
    aviso.remove();
  });
  aviso.querySelector('.aviso-cookies__recusar').addEventListener('click', () => {
    salvarEscolha('recusado');
    gtag('consent', 'update', { analytics_storage: 'denied' });
    aviso.remove();
  });
}
