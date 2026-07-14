import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { ordenarPorDistancia } from '../utils/distancia.js';
import { renderCardEmpresa } from '../components/card-empresa.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';

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

  const listaFinal = localizacao
    ? ordenarPorDistancia(empresas, localizacao.lat, localizacao.lng)
    : empresas;

  const avisoLocalizacao = !localizacao
    ? `<p class="aviso-localizacao">
         Não foi possível acessar sua localização, então a lista abaixo não está ordenada por distância.
         <button id="tentar-localizacao">Tentar de novo</button>
       </p>`
    : '';

  container.innerHTML = `
    <section class="resultados">
      <div id="carrossel-categoria" class="carrossel-categoria"></div>
      <h2>${localizacao ? 'Resultados perto de você' : 'Resultados disponíveis'}</h2>
      ${avisoLocalizacao}
      <div class="resultados-lista">
        ${listaFinal.map(renderCardEmpresa).join('')}
      </div>
    </section>
  `;

  renderCarrosselBanners('carrossel-categoria', categoria);

  const botaoTentar = container.querySelector('#tentar-localizacao');
  if (botaoTentar) {
    botaoTentar.addEventListener('click', () => renderResultados(container, categoria));
  }
}