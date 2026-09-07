import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { renderCardRanking } from '../components/card-empresa.js';
import { configurarAvaliacoes } from './resultados.js';

const CATEGORIA_TRABALHO = 'trabalho';

export async function renderRankingEmpresas(container) {
  container.innerHTML = `
    <section class="resultados">
      <div class="parceiras-pagina__header">
        <h1>🏆 Ranking das Empresas</h1>
        <p>As melhores empresas de transporte pra trabalhar, na opinião de quem já rodou com elas. Avalie a empresa onde você trabalha ou já trabalhou!</p>
      </div>
      <div id="ranking-lista">
        <p class="loading">Carregando...</p>
      </div>
    </section>
  `;

  const alvo = container.querySelector('#ranking-lista');

  try {
    const empresas = await buscarEmpresasPorCategoria(CATEGORIA_TRABALHO);

    if (empresas.length === 0) {
      alvo.innerHTML = `<p class="vazio">Nenhuma empresa cadastrada no ranking ainda.</p>`;
      return;
    }

    // Ordena da nota mais alta pra mais baixa. Em caso de empate, quem tem
    // mais avaliações vem primeiro (mais confiável que uma nota só).
    empresas.sort((a, b) => {
      const diferencaNota = (b.notaMedia || 0) - (a.notaMedia || 0);
      if (diferencaNota !== 0) return diferencaNota;
      return (b.totalAvaliacoes || 0) - (a.totalAvaliacoes || 0);
    });

    alvo.innerHTML = `
      <div class="resultados-lista">
        ${empresas.map((empresa, indice) => renderCardRanking(empresa, indice + 1)).join('')}
      </div>
    `;

    configurarAvaliacoes(container);
  } catch (erro) {
    alvo.innerHTML = `
      <div class="erro-carregamento">
        <p class="erro">Não conseguimos carregar o ranking agora. Tente novamente.</p>
        <button id="tentar-carregar-ranking" class="btn-secundario">🔄 Tentar de novo</button>
      </div>
    `;
    console.error(erro);
    container.querySelector('#tentar-carregar-ranking')?.addEventListener('click', () => renderRankingEmpresas(container));
  }
}
