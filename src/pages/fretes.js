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
        <p>Filtre pelo seu tipo de veículo e toque no frete para ver os detalhes</p>
      </div>

      ${ufsOrdenadas
        .map((uf) => {
          // Agrupa por veículo, já deixando a lista organizada por tipo (carreteiro vê tudo junto, caçamba vê tudo junto, etc).
          const lista = [...porEstado.get(uf)].sort((a, b) => a.veiculo.localeCompare(b.veiculo));

          const contagemPorVeiculo = new Map();
          lista.forEach((f) => contagemPorVeiculo.set(f.veiculo, (contagemPorVeiculo.get(f.veiculo) || 0) + 1));
          const veiculosOrdenados = [...contagemPorVeiculo.keys()].sort(
            (a, b) => contagemPorVeiculo.get(b) - contagemPorVeiculo.get(a)
          );

          const nomeEstado = NOME_ESTADO[uf] || uf;
          return `
            <div class="fretes-pagina__grupo" id="estado-${uf}">
              <h2 class="fretes-pagina__grupo-titulo">🚛 ${lista.length} frete${lista.length !== 1 ? 's' : ''} saindo de ${nomeEstado}</h2>

              <div class="fretes-pagina__filtros" data-estado="${uf}">
                <button class="chip chip--ativo" data-veiculo="">🌐 Todos</button>
                ${veiculosOrdenados
                  .map(
                    (v) =>
                      `<button class="chip" data-veiculo="${v}">${v} (${contagemPorVeiculo.get(v)})</button>`
                  )
                  .join('')}
              </div>

              <div class="fretes-pagina__lista" data-lista-estado="${uf}">
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

  container.querySelectorAll('.fretes-pagina__filtros').forEach((filtro) => {
    const uf = filtro.dataset.estado;
    const listaEl = container.querySelector(`[data-lista-estado="${uf}"]`);

    filtro.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        filtro.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip--ativo'));
        chip.classList.add('chip--ativo');

        const veiculoEscolhido = chip.dataset.veiculo;
        listaEl.querySelectorAll('.frete-card').forEach((card) => {
          const bate = !veiculoEscolhido || card.dataset.veiculo === veiculoEscolhido;
          card.classList.toggle('frete-card--oculto', !bate);
        });
      });
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
    <div class="frete-card ${frete.isExemplo ? 'frete-card--exemplo' : ''}" data-veiculo="${frete.veiculo}">
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
