import { buscarTodosFretes, NOME_ESTADO } from '../services/fretes.service.js';

const NUMERO_COMERCIAL = '5588988621481';

export async function renderFretes(container, estadoInicial = null) {
  container.innerHTML = `<p class="loading">Carregando fretes...</p>`;

  let fretes;
  try {
    fretes = await buscarTodosFretes();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar os fretes agora. Tente novamente.</p>`;
    console.error(erro);
    return;
  }

  if (fretes.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhum frete disponível no momento.</p>`;
    return;
  }

  const porEstado = new Map();
  fretes.forEach((f) => {
    const uf = f.estadoOrigem || '??';
    if (!porEstado.has(uf)) porEstado.set(uf, []);
    porEstado.get(uf).push(f);
  });

  const ufsOrdenadas = [...porEstado.keys()].sort((a, b) => {
    if (a === 'CE') return -1;
    if (b === 'CE') return 1;
    return a.localeCompare(b);
  });

  container.innerHTML = `
    <section class="fretes-pagina">
      <div class="fretes-pagina__header">
        <h1>📦 ${fretes.length} frete${fretes.length !== 1 ? 's' : ''} disponíve${fretes.length !== 1 ? 'is' : 'l'}</h1>
        <p>Toque em um frete para ver os detalhes completos</p>
      </div>

      ${ufsOrdenadas
        .map((uf) => {
          const lista = porEstado.get(uf);
          const nomeEstado = NOME_ESTADO[uf] || uf;
          return `
            <div class="fretes-pagina__grupo" id="estado-${uf}">
              <h2 class="fretes-pagina__grupo-titulo">🚛 ${lista.length} frete${lista.length !== 1 ? 's' : ''} saindo de ${nomeEstado}</h2>
              <div class="fretes-pagina__lista">
                ${lista.map(renderCardFrete).join('')}
              </div>
            </div>
          `;
        })
        .join('')}
    </section>
  `;

  container.querySelectorAll('.frete-card').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('frete-card--aberto');
    });
  });

  if (estadoInicial) {
    const alvo = container.querySelector(`#estado-${estadoInicial}`);
    if (alvo) {
      setTimeout(() => alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  }
}

function renderCardFrete(frete) {
  const rota = `${frete.cidadeOrigem}/${frete.estadoOrigem} → ${frete.cidadeDestino}/${frete.estadoDestino}`;
  const preco = frete.preco ? `R$ ${frete.preco}/ton` : 'Consultar valor';
  const peso = frete.pesoTon ? `${frete.pesoTon} toneladas` : '';
  const mensagem = encodeURIComponent(
    `Olá! Vi no TRA da Estrada o frete de ${frete.carga} saindo de ${frete.cidadeOrigem}/${frete.estadoOrigem} para ${frete.cidadeDestino}/${frete.estadoDestino} (${frete.veiculo} / ${frete.carroceria}). Tenho interesse!`
  );

  return `
    <div class="frete-card ${frete.isExemplo ? 'frete-card--exemplo' : ''}">
      ${frete.isExemplo ? '<span class="mini-card__tag-exemplo">EXEMPLO</span>' : ''}
      <div class="frete-card__resumo">
        <div>
          <p class="frete-card__rota">${rota}</p>
          <p class="frete-card__basico">${frete.veiculo} • ${frete.carroceria} — ${frete.carga}</p>
        </div>
        <span class="frete-card__seta">▾</span>
      </div>
      <div class="frete-card__detalhe">
        <p><strong>Carga:</strong> ${frete.carga} (${frete.especie})</p>
        <p><strong>Veículo:</strong> ${frete.veiculo}</p>
        <p><strong>Carroceria:</strong> ${frete.carroceria}</p>
        <p><strong>Valor:</strong> ${preco}</p>
        ${peso ? `<p><strong>Peso:</strong> ${peso}</p>` : ''}
        ${frete.obs ? `<p><strong>Observação:</strong> ${frete.obs}</p>` : ''}
        <a href="https://wa.me/${NUMERO_COMERCIAL}?text=${mensagem}" target="_blank" rel="noopener" class="frete-card__whatsapp" onclick="event.stopPropagation()">💬 Falar no WhatsApp para fechar esse frete</a>
      </div>
    </div>
  `;
}
