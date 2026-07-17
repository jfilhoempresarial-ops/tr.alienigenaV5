const EMPRESAS_PARCEIRAS = [
  {
    nome: 'Pneu\'s Teatro Center',
    descricao: 'Descrição em breve.',
  },
  {
    nome: 'Banco Omni',
    descricao: 'Descrição em breve.',
  },
];

export function renderEmpresasParceiras(container) {
  container.innerHTML = `
    <section class="parceiras-pagina">
      <div class="parceiras-pagina__header">
        <h1>🤝 Empresas Parceiras</h1>
        <p>Marcas de confiança que apoiam o motorista brasileiro.</p>
      </div>

      <div class="parceiras-lista">
        ${EMPRESAS_PARCEIRAS.map(
          (empresa) => `
          <div class="parceira-card">
            <p class="parceira-card__nome">${empresa.nome}</p>
            <p class="parceira-card__descricao">${empresa.descricao}</p>
          </div>
        `
        ).join('')}
      </div>
    </section>
  `;
}
