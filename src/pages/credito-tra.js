import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';

const NUMERO_WHATSAPP = '5588988621481';
const LINK_WHATSAPP = gerarLinkWhatsapp(
  NUMERO_WHATSAPP,
  'Olá! Vim do site da TRA e quero saber mais sobre o Crédito TRA.'
);

const SOLUCOES = [
  {
    titulo: '💰 Crédito Consignado',
    descricao:
      'Empréstimo com desconto direto na folha ou no benefício, parcelas menores e taxas mais baixas que o crédito comum.',
  },
  {
    titulo: '💡 Crédito na Conta de Luz',
    descricao:
      'Empréstimo com desconto direto na fatura de energia, aprovação rápida e sem burocracia.',
  },
  {
    titulo: '🏦 Liberação de FGTS',
    descricao:
      'Antecipação do saque-aniversário do FGTS, o dinheiro cai direto na sua conta sem complicação.',
  },
  {
    titulo: '🏢 Crédito para Empresas',
    descricao:
      'Capital de giro e crédito para autônomos e pequenos empresários do transporte, do jeito que sua operação precisa.',
  },
];

export function renderCreditoTRA(container) {
  container.innerHTML = `
    <section class="cursos-pagina">
      <div class="cursos-pagina__header">
        <h1>💳 Crédito TRA</h1>
        <p>Precisando de dinheiro? A gente tem soluções financeiras pensadas pra quem vive na estrada.</p>
      </div>

      <div class="cursos-pagina__destaque">
        <h2 class="cursos-pagina__destaque-titulo">💬 Fale com a gente</h2>
        <p class="cursos-pagina__destaque-texto">
          Conta pra gente sua necessidade que a gente te ajuda a encontrar a melhor solução de crédito.
        </p>
        <a href="${LINK_WHATSAPP}" target="_blank" rel="noopener" class="cursos-pagina__destaque-link">
          Falar com um especialista →
        </a>
      </div>

      <h2 class="cursos-pagina__secao-titulo">📋 Nossas soluções</h2>
      <p class="cursos-pagina__secao-sub">
        Cada situação é diferente — conversa com a gente e encontramos a opção que faz mais sentido pro seu bolso.
      </p>

      <div class="cursos-lista">
        ${SOLUCOES.map(
          (solucao) => `
          <div class="curso-card">
            <p class="curso-card__titulo">${solucao.titulo}</p>
            <p class="curso-card__descricao">${solucao.descricao}</p>
          </div>
        `
        ).join('')}
      </div>

      <a href="${LINK_WHATSAPP}" target="_blank" rel="noopener" class="cursos-pagina__botao-todos">
        💳 Simular meu crédito agora
      </a>
    </section>
  `;
}
