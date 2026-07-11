import { gerarRelatorioCliques } from '../services/relatorios.service.js';

export async function renderRelatorioCliques(container) {
  container.innerHTML = `<p class="loading">Carregando relatório...</p>`;

  const dados = await gerarRelatorioCliques();

  if (dados.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhum clique registrado ainda.</p>`;
    return;
  }

  container.innerHTML = `
    <section class="relatorio">
      <h2>Cliques por banner</h2>
      <table class="relatorio__tabela">
        <thead>
          <tr>
            <th>Empresa</th>
            <th>Mês</th>
            <th>Cliques</th>
          </tr>
        </thead>
        <tbody>
          ${dados
            .map(
              (linha) => `
            <tr>
              <td>${linha.empresaNome}</td>
              <td>${linha.mesAno}</td>
              <td>${linha.totalCliques}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </section>
  `;
}
