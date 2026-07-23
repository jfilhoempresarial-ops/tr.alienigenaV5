import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { ordenarPorDistancia } from '../utils/distancia.js';
import { renderCardEmpresa } from '../components/card-empresa.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';
import { avaliarEmpresa } from '../services/avaliacoes.service.js';

// Texto de exemplo (placeholder) da busca em cada categoria. Categorias que
// não tinham um texto específico caem no placeholder genérico (pode buscar
// por serviço OU por cidade — ex: "Sobral", "freio", "diesel").
const PLACEHOLDER_BUSCA = {
  mecanico: 'Digite o problema ou a cidade (ex: motor, freio, embreagem, Sobral)',
  borracharia: 'Digite o que você precisa ou a cidade (ex: furo, calibragem, Sobral)',
  eletrica: 'Digite o problema ou a cidade (ex: bateria, alternador, Sobral)',
  guincho: 'Digite sua emergência ou a cidade (ex: pane, acidente, Sobral)',
  pontoapoio: 'Digite o que você procura ou a cidade',
  autopecas: 'Digite a peça ou a cidade que você procura',
  tacografo: 'Digite o que você precisa ou a cidade (ex: aferição, Sobral)',
};
const PLACEHOLDER_BUSCA_PADRAO = 'Digite a cidade ou o que você procura';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

  // NÃO pedimos localização automaticamente mais — o motorista decide se
  // quer usar (botão "Usar minha localização"), já que boa parte não libera
  // GPS e isso só atrasava a página sem necessidade pra quem prefere digitar
  // a cidade na busca. Por padrão, a lista mostra tudo, sem ordenar por
  // distância nem filtrar por raio.
  let localizacao = null;
  let buscandoLocalizacao = false;
  let empresasBase = empresas;

  const placeholderBusca = PLACEHOLDER_BUSCA[categoria] || PLACEHOLDER_BUSCA_PADRAO;
  let filtroTexto = '';

  function aplicarFiltro() {
    let lista = empresasBase;
    if (filtroTexto) {
      const qn = normalizar(filtroTexto);
      lista = lista.filter((empresa) => {
        const nome = normalizar(empresa.nome);
        const endereco = normalizar(empresa.endereco);
        const cidade = normalizar(empresa.cidade);
        return nome.includes(qn) || endereco.includes(qn) || cidade.includes(qn);
      });
    }
    if (localizacao) {
      lista = lista.filter((empresa) => empresa.distanciaKm !== null && empresa.distanciaKm <= RAIO_KM);
    }
    return lista;
  }

  async function usarLocalizacao() {
    buscandoLocalizacao = true;
    render();

    try {
      const loc = await obterLocalizacaoAtual();
      localizacao = loc;
      empresasBase = ordenarPorDistancia(empresas, loc.lat, loc.lng);
    } catch (erro) {
      console.warn('Não foi possível obter a localização.', erro);
      alert('Não foi possível acessar sua localização. Confira se a permissão está ativada.');
    }

    buscandoLocalizacao = false;
    render();
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

        <input
          type="text"
          id="resultados-busca"
          class="resultados__busca"
          placeholder="${placeholderBusca}"
          value="${filtroTexto}"
        />

        <button id="usar-localizacao-btn" class="resultados__localizacao-btn" ${buscandoLocalizacao ? 'disabled' : ''}>
          ${
            buscandoLocalizacao
              ? '⏳ Buscando sua localização...'
              : localizacao
                ? '📍 Localização ativada — resultados num raio de 20km'
                : '📍 Usar minha localização (ordenar por distância)'
          }
        </button>

        <h2>${listaFinal.length} resultado${listaFinal.length !== 1 ? 's' : ''} ${localizacao ? 'perto de você' : 'disponíve' + (listaFinal.length !== 1 ? 'is' : 'l')}</h2>
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

    const botaoLocalizacao = container.querySelector('#usar-localizacao-btn');
    if (botaoLocalizacao && !localizacao) {
      botaoLocalizacao.addEventListener('click', usarLocalizacao);
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