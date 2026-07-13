import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { ordenarPorDistancia } from '../utils/distancia.js';
import { renderCardEmpresa } from '../components/card-empresa.js';

export async function renderResultados(container, categoria) {
  container.innerHTML = `<p class="loading">Buscando sua localização...</p>`;

  try {
    const [empresas, localizacao] = await Promise.all([
      buscarEmpresasPorCategoria(categoria),
      obterLocalizacaoAtual(),
    ]);

    const ordenadas = ordenarPorDistancia(empresas, localizacao.lat, localizacao.lng);

    if (ordenadas.length === 0) {
      container.innerHTML = `<p class="vazio">Nenhuma empresa cadastrada nessa categoria ainda perto de você.</p>`;
      return;
    }

    container.innerHTML = `
      <section class="resultados">
        <h2>Resultados perto de você</h2>
        <div class="resultados-lista">
          ${ordenadas.map(renderCardEmpresa).join('')}
        </div>
      </section>
    `;
  } catch (erro) {
    container.innerHTML = `
      <p class="erro">
        Não conseguimos acessar sua localização. Verifique se a permissão foi concedida
        e tente novamente.
      </p>
    `;
    console.error(erro);
  }
}
