import { buscarCotacoes } from '../services/cotacoes.service.js';

const ICONE_POR_ITEM = {
  Dólar: '💵',
  Diesel: '⛽',
  Gasolina: '⛽',
  Etanol: '🌿',
  Petróleo: '🛢️',
};

export async function renderTickerCotacoes() {
  const el = document.getElementById('ticker-cotacoes');
  if (!el) return;

  try {
    const itens = await buscarCotacoes();
    if (itens.length === 0) {
      el.innerHTML = '';
      return;
    }

    const texto = itens
      .map((item) => `${ICONE_POR_ITEM[item.label] || '📊'} ${item.label}: ${item.unidade} ${item.valor}`)
      .join('&nbsp;&nbsp;•&nbsp;&nbsp;');

    // Duplica o texto uma vez, lado a lado, pra rolagem ficar contínua e
    // sem espaço em branco entre uma volta e outra.
    el.innerHTML = `
      <style>
        .ticker-cotacoes {
          background: #fff;
          color: #111;
          overflow: hidden;
          white-space: nowrap;
          border-bottom: 1px solid #eee;
          padding: 6px 0;
          font-size: 0.85rem;
        }
        .ticker-cotacoes__trilho {
          display: inline-block;
          padding-left: 100%;
          animation: ticker-rolar 30s linear infinite;
        }
        .ticker-cotacoes__item {
          padding: 0 16px;
        }
        @keyframes ticker-rolar {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
      </style>
      <div class="ticker-cotacoes">
        <div class="ticker-cotacoes__trilho">
          <span class="ticker-cotacoes__item">${texto}</span><span class="ticker-cotacoes__item">${texto}</span>
        </div>
      </div>
    `;
  } catch (erro) {
    // Se der erro, simplesmente não mostra a fita — não é conteúdo
    // essencial o bastante pra atrapalhar o resto da página.
    el.innerHTML = '';
    console.error('Não foi possível carregar as cotações:', erro);
  }
}
