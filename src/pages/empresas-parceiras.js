import { buscarEmpresasParceiras } from '../services/banners.service.js';

export async function renderEmpresasParceiras(container) {
  container.innerHTML = `
    <section class="parceiras-pagina">
      <div class="parceiras-pagina__header">
        <h1>🤝 Empresas Parceiras</h1>
        <p>Marcas de confiança que apoiam o motorista brasileiro.</p>
      </div>
      <div class="parceiras-lista" id="parceiras-lista">
        <p class="loading">Carregando...</p>
      </div>
    </section>
  `;

  const alvo = container.querySelector('#parceiras-lista');

  try {
    const parceiras = await buscarEmpresasParceiras();

    if (parceiras.length === 0) {
      alvo.innerHTML = `<p class="vazio">Nenhuma empresa parceira no momento.</p>`;
      return;
    }

    alvo.innerHTML = parceiras
      .map(
        (empresa) => `
        <div class="parceira-card">
          <p class="parceira-card__nome">${empresa.nome}</p>
          ${
            empresa.link
              ? `<a href="${empresa.link}" target="_blank" rel="noopener" class="parceira-card__link">Saiba mais</a>`
              : ''
          }
        </div>
      `
      )
      .join('');
  } catch (erro) {
    alvo.innerHTML = `<p class="erro">Não foi possível carregar as empresas parceiras agora.</p>`;
    console.error(erro);
  }
}