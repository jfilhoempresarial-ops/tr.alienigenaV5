import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { ordenarPorDistancia } from '../utils/distancia.js';
import { renderCardEmpresa } from '../components/card-empresa.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';

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
};

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export async function renderResultados(container, categoria) {
  container.innerHTML = `<p class="loading">Buscando prestadores...</p>`;

  let empresas;
  try {
    empresas = await buscarEmpresasPorCategoria(categoria);
  } catch (erro) {
    container.innerHTML = `
      <p class="erro">
        Não conseguimos carregar os prestadores dessa categoria agora. Tente novamente em instantes.
      </p>
    `;
    console.error(erro);
    return;
  }

  if (empresas.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhuma empresa cadastrada nessa categoria ainda.</p>`;
    return;
  }

  // A localização é só um "bônus" para ordenar por distância.
  // Se falhar (permissão negada, sem GPS, timeout), mostramos a lista mesmo assim, sem ordenar.
  let localizacao = null;
  try {
    localizacao = await obterLocalizacaoAtual();
  } catch (erro) {
    console.warn('Localização indisponível, mostrando lista sem ordenar por distância.', erro);
  }

  const listaBase = localizacao
    ? ordenarPorDistancia(empresas, localizacao.lat, localizacao.lng)
    : empresas;

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

        <h2>${localizacao ? 'Resultados perto de você' : 'Resultados disponíveis'}</h2>
        ${avisoLocalizacao}
        <div class="resultados-lista">
          ${
            listaFinal.length
              ? listaFinal.map(renderCardEmpresa).join('')
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
  }

  render();
}
