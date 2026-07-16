import { buscarTodosFretes } from '../services/fretes.service.js';

const NUMERO_COMERCIAL = '5588988621481';

export async function renderFretes(container) {
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

  const doCeara = fretes.filter((f) => f.regiao === 'ceara');
  const deOutros = fretes.filter((f) => f.regiao !== 'ceara');

  container.innerHTML = `
    <section class="fretes-pagina">
      <div class="fretes-pagina__header">
        <h1>📦 Fretes disponíveis</h1>
        <p>Toque em um frete para ver os detalhes completos</p>
      </div>

      <div class="fretes-pagina__grupo">
        <h2 class="fretes-pagina__grupo-titulo">🚛 ${doCeara.length} frete${doCeara.length !== 1 ? 's' : ''} para o Ceará</h2>
        <div class="fretes-pagina__lista">
          ${doCeara.length ? doCeara.map(renderCardFrete).join('') : '<p class="vazio">Nenhum frete para o Ceará no momento.</p>'}
        </div>
      </div>

      <div class="fretes-pagina__grupo">
        <h2 class="fretes-pagina__grupo-titulo">🌎 ${deOutros.length} frete${deOutros.length !== 1 ? 's' : ''} para outros estados do Brasil</h2>
        <div class="fretes-pagina__lista">
          ${deOutros.length ? deOutros.map(renderCardFrete).join('') : '<p class="vazio">Nenhum frete para outros estados no momento.</p>'}
        </div>
      </div>
    </section>
  `;

  container.querySelectorAll('.frete-card').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('frete-card--aberto');
    });
  });
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
