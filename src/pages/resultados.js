import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { ordenarPorDistancia } from '../utils/distancia.js';
import { renderCardEmpresa } from '../components/card-empresa.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';
import { avaliarEmpresa } from '../services/avaliacoes.service.js';

// Texto de exemplo (placeholder) da busca em cada categoria.
// Categorias que NÃO aparecem aqui (ex: "posto") não mostram caixa de busca —
// só o carrossel de banner, para o anunciante (ex: preço do combustível).
const PLACEHOLDER_BUSCA = {
  mecanico: 'Digite o problema do seu caminhão (ex: motor, freio, embreagem)',
  borracharia: 'Digite o que você precisa (ex: furo, calibragem, tira prego)',
  eletrica: 'Digite o problema elétrico (ex: bateria, alternador, luz)',
  guincho: 'Digite sua emergência (ex: pane, acidente, atolado)',
  pontoapoio: 'Digite o que você procura',
  autopecas: 'Digite a peça que você procura',
  tacografo: 'Digite o que você precisa (ex: aferição, calibração, cronotacógrafo)',
};

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Evita que a busca de localização trave a página para sempre caso o
// navegador demore demais para responder (ex: popup de permissão que
// não aparece, GPS lento). Depois de 5s, seguimos sem localização.
function obterLocalizacaoComTimeout(ms = 5000) {
  return Promise.race([
    obterLocalizacaoAtual(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout de localização')), ms)),
  ]);
}

// Em algumas redes móveis (sinal fraco de rodovia, "modo economia de dados"
// da operadora, proxy que bloqueia conexões do tipo WebChannel), a consulta
// ao Firestore pode ficar pendurada pra sempre — sem dar erro, sem responder.
// Sem esse limite, a tela ficava travada em "Buscando prestadores..." pra
// sempre nesses casos. Com o timeout, cai no bloco de erro (com botão de
// tentar de novo) depois de 12s em vez de travar.
function buscarComTimeout(promessa, ms = 12000) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ao buscar prestadores')), ms)),
  ]);
}

export async function renderResultados(container, categoria) {
  container.innerHTML = `<p class="loading">Buscando prestadores...</p>`;

  let empresas;
  try {
    empresas = await buscarComTimeout(buscarEmpresasPorCategoria(categoria));
  } catch (erro) {
    container.innerHTML = `
      <div class="erro-carregamento">
        <p class="erro">
          Não conseguimos carregar os prestadores dessa categoria agora. Isso pode acontecer com sinal fraco
          de internet. Tente novamente.
        </p>
        <button id="tentar-carregar-empresas" class="btn-secundario">🔄 Tentar de novo</button>
      </div>
    `;
    console.error(erro);
    const botaoTentarCarregar = container.querySelector('#tentar-carregar-empresas');
    if (botaoTentarCarregar) {
      botaoTentarCarregar.addEventListener('click', () => renderResultados(container, categoria));
    }
    return;
  }

  if (empresas.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhuma empresa cadastrada nessa categoria ainda.</p>`;
    return;
  }

  const RAIO_KM = 20;

  // A localização é só um "bônus" para ordenar por distância.
  // Se falhar ou demorar demais (permissão negada, sem GPS, timeout),
  // mostramos a lista mesmo assim, sem ordenar nem filtrar por raio.
  let localizacao = null;
  try {
    localizacao = await obterLocalizacaoComTimeout();
  } catch (erro) {
    console.warn('Localização indisponível, mostrando lista sem ordenar por distância.', erro);
  }

  const listaOrdenada = localizacao
    ? ordenarPorDistancia(empresas, localizacao.lat, localizacao.lng)
    : empresas;

  // Com localização disponível, só mantém prestadores dentro de 20km
  // (empresas sem coordenadas ainda não entram, pois não dá pra confirmar a distância).
  const listaBase = localizacao
    ? listaOrdenada.filter((empresa) => empresa.distanciaKm !== null && empresa.distanciaKm <= RAIO_KM)
    : listaOrdenada;

  const avisoLocalizacao = !localizacao
    ? `<p class="aviso-localizacao">
         Não foi possível acessar sua localização, então a lista abaixo não está ordenada por distância.
         <button id="tentar-localizacao">Tentar de novo</button>
       </p>`
    : '';

  const placeholderBusca = PLACEHOLDER_BUSCA[categoria];
  let filtroTexto = '';

  function aplicarFiltro() {
    if (!placeholderBusca || !filtroTexto) return listaBase;
    const qn = normalizar(filtroTexto);
    return listaBase.filter((empresa) => {
      const nome = normalizar(empresa.nome);
      const endereco = normalizar(empresa.endereco);
      return nome.includes(qn) || endereco.includes(qn);
    });
  }

  function render() {
    const listaFinal = aplicarFiltro();

    container.innerHTML = `
      <section class="resultados">
        <div id="carrossel-categoria" class="carrossel-categoria"></div>

        <a href="/cadastro-empresa" class="banner-grupos">
          <span class="banner-grupos__icone">🏢</span>
          <span class="banner-grupos__texto">
            <strong>Sua empresa não está aqui?</strong>
            Cadastre grátis e apareça para motoristas da região
          </span>
          <span class="banner-grupos__seta">›</span>
        </a>

        ${
          placeholderBusca
            ? `<input
                type="text"
                id="resultados-busca"
                class="resultados__busca"
                placeholder="${placeholderBusca}"
                value="${filtroTexto}"
              />`
            : ''
        }

        <h2>${localizacao ? `${listaFinal.length} resultado${listaFinal.length !== 1 ? 's' : ''} perto de você` : `${listaFinal.length} resultado${listaFinal.length !== 1 ? 's' : ''} disponíve${listaFinal.length !== 1 ? 'is' : 'l'}`}</h2>
        ${avisoLocalizacao}
        <div class="resultados-lista">
          ${
            listaFinal.length
              ? listaFinal.map(renderCardEmpresa).join('')
              : localizacao && !filtroTexto
              ? `<p class="vazio">Nenhum prestador encontrado num raio de 20km da sua localização nessa categoria.</p>`
              : '<p class="vazio">Nenhum resultado encontrado com esse filtro.</p>'
          }
        </div>
      </section>
    `;

    renderCarrosselBanners('carrossel-categoria', categoria);

    const botaoTentar = container.querySelector('#tentar-localizacao');
    if (botaoTentar) {
      botaoTentar.addEventListener('click', () => renderResultados(container, categoria));
    }

    const inputBusca = container.querySelector('#resultados-busca');
    if (inputBusca) {
      inputBusca.addEventListener('input', (e) => {
        filtroTexto = e.target.value;
        render();
        const alvo = container.querySelector('#resultados-busca');
        alvo.focus();
        alvo.setSelectionRange(filtroTexto.length, filtroTexto.length);
      });
    }

    configurarAvaliacoes(container);
  }

  render();
}

function configurarAvaliacoes(container) {
  container.querySelectorAll('.card-empresa__avaliar-btn').forEach((botao) => {
    botao.addEventListener('click', () => {
      const empresaId = botao.dataset.abrirAvaliacao;
      const painel = container.querySelector(`#avaliar-notas-${empresaId}`);
      if (painel) painel.hidden = !painel.hidden;
    });
  });

  container.querySelectorAll('.nota-btn').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const empresaId = botao.dataset.empresaAvaliar;
      const nota = Number(botao.dataset.nota);
      const chaveLocal = `tra-avaliou-${empresaId}`;
      const painel = container.querySelector(`#avaliar-notas-${empresaId}`);

      if (localStorage.getItem(chaveLocal)) {
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Você já avaliou esta empresa neste dispositivo. Obrigado! 🙌</p>`;
        }
        return;
      }

      try {
        await avaliarEmpresa(empresaId, nota);
        localStorage.setItem(chaveLocal, '1');
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Obrigado pela avaliação! 🙌</p>`;
        }
      } catch (erro) {
        console.error(erro);
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Não foi possível registrar agora. Tente novamente.</p>`;
        }
      }
    });
  });
}