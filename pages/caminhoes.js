import { buscarCaminhoesVerificados } from '../services/caminhoes.service.js';
import { renderCardCaminhao } from '../components/card-caminhao.js';

export async function renderCaminhoes(container) {
  container.innerHTML = `<p class="loading">Carregando anúncios...</p>`;

  const caminhoes = await buscarCaminhoesVerificados();

  container.innerHTML = `
    <section class="caminhoes">
      <div class="caminhoes__header">
        <h2>Compra e Venda de Caminhões</h2>
        <a href="#/cadastro-caminhao" class="navbar__cta">Anunciar meu caminhão</a>
      </div>
      ${
        caminhoes.length === 0
          ? `<p class="vazio">Nenhum caminhão anunciado ainda.</p>`
          : `<div class="caminhoes-lista">${caminhoes.map(renderCardCaminhao).join('')}</div>`
      }
    </section>
  `;
}
