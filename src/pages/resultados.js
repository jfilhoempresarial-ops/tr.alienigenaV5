import { buscarEmpresasPorCategoria } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { ordenarPorDistancia } from '../utils/distancia.js';
import { renderCardEmpresa, renderCardAvaliacao } from '../components/card-empresa.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';
import { avaliarEmpresa, buscarUltimasAvaliacoes } from '../services/avaliacoes.service.js';
import { fazerLoginGoogle, usuarioAtual } from '../services/auth.service.js';
import { NOME_ESTADO } from '../services/fretes.service.js';

// Texto de exemplo (placeholder) da busca em cada categoria. Categorias que
// não tinham um texto específico caem no placeholder genérico (pode buscar
// por serviço OU por cidade — ex: "Sobral", "freio", "diesel").
const PLACEHOLDER_BUSCA = {
  mecanico: 'Digite o problema ou a cidade (ex: motor, freio, embreagem, Sobral)',
  borracharia: 'Digite o que você precisa ou a cidade (ex: furo, calibragem, Sobral)',
  eletrica: 'Digite o problema ou a cidade (ex: bateria, alternador, Sobral)',
  guincho: 'Digite sua emergência ou a cidade (ex: pane, acidente, Sobral)',
  pontoapoio: 'Digite o que você procura ou a cidade',
  autopecas: 'Digite a peça ou a cidade que você procura',
  tacografo: 'Digite o que você precisa ou a cidade (ex: aferição, Sobral)',
};
const PLACEHOLDER_BUSCA_PADRAO = 'Digite a cidade ou o que você procura';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Em algumas redes móveis (sinal fraco de rodovia, "modo economia de dados"
// da operadora, proxy que bloqueia conexões do tipo WebChannel), a consulta
// ao Firestore pode ficar pendurada pra sempre — sem dar erro, sem responder.
// Sem esse limite, a tela ficava travada em "Buscando prestadores..." pra
// sempre nesses casos. Com o timeout, cai no bloco de erro (com botão de
// tentar de novo) depois de 12s em vez de travar.
function buscarComTimeout(promessa, ms = 12000) {
  return Promise.race([
    promessa,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout ao buscar prestadores')), ms)),
  ]);
}

export async function renderResultados(container, categoria) {
  container.innerHTML = `<p class="loading">Buscando prestadores...</p>`;

  let empresas;
  try {
    empresas = await buscarComTimeout(buscarEmpresasPorCategoria(categoria));
  } catch (erro) {
    container.innerHTML = `
      <div class="erro-carregamento">
        <p class="erro">
          Não conseguimos carregar os prestadores dessa categoria agora. Isso pode acontecer com sinal fraco
          de internet. Tente novamente.
        </p>
        <button id="tentar-carregar-empresas" class="btn-secundario">🔄 Tentar de novo</button>
      </div>
    `;
    console.error(erro);
    const botaoTentarCarregar = container.querySelector('#tentar-carregar-empresas');
    if (botaoTentarCarregar) {
      botaoTentarCarregar.addEventListener('click', () => renderResultados(container, categoria));
    }
    return;
  }

  if (empresas.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhuma empresa cadastrada nessa categoria ainda.</p>`;
    return;
  }

  // A categoria "pontoapoio" mistura prestadores da planilha (Setor "Ponto
  // de Apoio", cadastrados manualmente) com os PPDs oficiais certificados
  // pelo governo (origem: "ppd-gov-br", via scripts/buscar-ppd-gov.cjs).
  // Nessa página específica, mostramos só os PPDs de verdade — os
  // prestadores da planilha continuam existindo normalmente e aparecem
  // na busca geral do site, só não entram aqui.
  if (categoria === 'pontoapoio') {
    empresas = empresas.filter((e) => e.origem === 'ppd-gov-br');
  }

  if (empresas.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhum PPD certificado encontrado no momento.</p>`;
    return;
  }

  const RAIO_KM = 20;

  // NÃO pedimos localização automaticamente mais — o motorista decide se
  // quer usar (botão "Usar minha localização"), já que boa parte não libera
  // GPS e isso só atrasava a página sem necessidade pra quem prefere digitar
  // a cidade na busca. Por padrão, a lista mostra tudo, sem ordenar por
  // distância nem filtrar por raio.
  let localizacao = null;
  let buscandoLocalizacao = false;
  let empresasBase = empresas;

  const placeholderBusca = PLACEHOLDER_BUSCA[categoria] || PLACEHOLDER_BUSCA_PADRAO;
  let filtroTexto = '';

  function aplicarFiltro() {
    let lista = empresasBase;
    if (filtroTexto) {
      const qn = normalizar(filtroTexto);
      lista = lista.filter((empresa) => {
        const nome = normalizar(empresa.nome);
        const endereco = normalizar(empresa.endereco);
        const cidade = normalizar(empresa.cidade);
        return nome.includes(qn) || endereco.includes(qn) || cidade.includes(qn);
      });
    }
    if (localizacao) {
      lista = lista.filter((empresa) => empresa.distanciaKm !== null && empresa.distanciaKm <= RAIO_KM);
    }
    return lista;
  }

  async function usarLocalizacao() {
    buscandoLocalizacao = true;
    render();

    try {
      const loc = await obterLocalizacaoAtual();
      localizacao = loc;
      empresasBase = ordenarPorDistancia(empresas, loc.lat, loc.lng);
    } catch (erro) {
      console.warn('Não foi possível obter a localização.', erro);
      alert('Não foi possível acessar sua localização. Confira se a permissão está ativada.');
    }

    buscandoLocalizacao = false;
    render();
  }

  // Agrupamos por estado em TODAS as categorias agora — ajuda a navegar
  // quando tem muitos resultados espalhados pelo Brasil (ex: Mecânico,
  // Borracharia). Igual a página de fretes.
  const AGRUPAR_POR_ESTADO = true;

  function renderListaPorEstado(listaFinal) {
    const porEstado = new Map();
    listaFinal.forEach((empresa) => {
      // .toUpperCase() normaliza "Ce" e "CE" pro mesmo grupo — a planilha
      // tem essa inconsistência em algumas linhas mais antigas.
      const uf = (empresa.estado || '??').toUpperCase();
      if (!porEstado.has(uf)) porEstado.set(uf, []);
      porEstado.get(uf).push(empresa);
    });

    const ufsOrdenadas = [...porEstado.keys()].sort((a, b) => {
      if (a === 'CE') return -1;
      if (b === 'CE') return 1;
      return a.localeCompare(b);
    });

    const textoItem = (qtd) =>
      categoria === 'pontoapoio' ? `PPD${qtd !== 1 ? 's' : ''} ANTT` : `resultado${qtd !== 1 ? 's' : ''}`;

    const chips = `
      <div class="fretes-pagina__filtros" id="resultados-filtro-estados">
        <button class="chip chip--ativo" data-estado-resultado="">🌐 Todos</button>
        ${ufsOrdenadas
          .map((uf) => {
            const nomeEstado = NOME_ESTADO[uf] || uf;
            return `<button class="chip" data-estado-resultado="${uf}">${nomeEstado} (${porEstado.get(uf).length})</button>`;
          })
          .join('')}
      </div>
    `;

    const grupos = ufsOrdenadas
      .map((uf) => {
        const itens = porEstado.get(uf);
        const nomeEstado = NOME_ESTADO[uf] || uf;
        return `
          <div class="fretes-pagina__grupo" data-grupo-estado-resultado="${uf}">
            <h2 class="fretes-pagina__grupo-titulo">📍 ${itens.length} ${textoItem(itens.length)} em ${nomeEstado}</h2>
            <div class="resultados-lista">
              ${itens.map(renderCardEmpresa).join('')}
            </div>
          </div>
        `;
      })
      .join('');

    return chips + grupos;
  }

  function render() {
    const listaFinal = aplicarFiltro();

    container.innerHTML = `
      <section class="resultados">
        <div id="carrossel-categoria" class="carrossel-categoria"></div>

        <a
          href="/cadastro-empresa"
          class="banner-grupos"
          style="display:block;text-align:center;background:#16a34a;color:#fff;font-weight:700;padding:14px 16px;border-radius:10px;text-decoration:none;"
        >
          Cadastre sua empresa grátis
        </a>

        <div class="home-secao">
          <div class="home-secao__header">
            <h2 class="home-secao__titulo">💬 Últimas avaliações</h2>
          </div>
          <div id="ultimas-avaliacoes-categoria">
            <p class="home-secao__vazio">Carregando...</p>
          </div>
        </div>

        <input
          type="text"
          id="resultados-busca"
          class="resultados__busca"
          placeholder="${placeholderBusca}"
          value="${filtroTexto}"
        />

        <button id="usar-localizacao-btn" class="resultados__localizacao-btn" ${buscandoLocalizacao ? 'disabled' : ''}>
          ${
            buscandoLocalizacao
              ? '⏳ Buscando sua localização...'
              : localizacao
                ? '📍 Localização ativada — resultados num raio de 20km'
                : '📍 Usar minha localização (ordenar por distância)'
          }
        </button>

        <h2><span class="resultados__contador">${listaFinal.length} resultado${listaFinal.length !== 1 ? 's' : ''} ${localizacao ? 'perto de você' : 'disponíve' + (listaFinal.length !== 1 ? 'is' : 'l')}</span></h2>
        ${
          AGRUPAR_POR_ESTADO && listaFinal.length
            ? renderListaPorEstado(listaFinal)
            : `
        <div class="resultados-lista">
          ${
            listaFinal.length
              ? listaFinal.map(renderCardEmpresa).join('')
              : localizacao && !filtroTexto
              ? `<p class="vazio">Nenhum prestador encontrado num raio de 20km da sua localização nessa categoria.</p>`
              : '<p class="vazio">Nenhum resultado encontrado com esse filtro.</p>'
          }
        </div>
        `
        }
      </section>
    `;

    renderCarrosselBanners('carrossel-categoria', categoria);
    carregarUltimasAvaliacoes(container, categoria);

    const botaoLocalizacao = container.querySelector('#usar-localizacao-btn');
    if (botaoLocalizacao && !localizacao) {
      botaoLocalizacao.addEventListener('click', usarLocalizacao);
    }

    const inputBusca = container.querySelector('#resultados-busca');
    if (inputBusca) {
      inputBusca.addEventListener('input', (e) => {
        filtroTexto = e.target.value;
        render();
        const alvo = container.querySelector('#resultados-busca');
        alvo.focus();
        alvo.setSelectionRange(filtroTexto.length, filtroTexto.length);
      });
    }

    const filtroEstadosResultados = container.querySelector('#resultados-filtro-estados');
    if (filtroEstadosResultados) {
      filtroEstadosResultados.querySelectorAll('.chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          filtroEstadosResultados.querySelectorAll('.chip').forEach((c) => c.classList.remove('chip--ativo'));
          chip.classList.add('chip--ativo');

          const ufEscolhida = chip.dataset.estadoResultado;
          container.querySelectorAll('[data-grupo-estado-resultado]').forEach((grupo) => {
            const bate = !ufEscolhida || grupo.dataset.grupoEstadoResultado === ufEscolhida;
            grupo.style.display = bate ? '' : 'none';
          });
        });
      });
    }

    configurarAvaliacoes(container);
  }

  render();
}

function configurarAvaliacoes(container) {
  container.querySelectorAll('.card-empresa__avaliar-btn[data-abrir-avaliacao]').forEach((botao) => {
    botao.addEventListener('click', () => {
      const empresaId = botao.dataset.abrirAvaliacao;
      const painel = container.querySelector(`#avaliar-notas-${empresaId}`);
      if (!painel) return;
      const vaiAbrir = painel.hidden;
      painel.hidden = !vaiAbrir;
      if (vaiAbrir) atualizarPainelLoginAvaliacao(container, empresaId);
    });
  });

  container.querySelectorAll('[data-login-google]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const empresaId = botao.dataset.loginGoogle;
      const textoOriginal = botao.textContent;
      botao.disabled = true;
      botao.textContent = 'Entrando...';
      try {
        await fazerLoginGoogle();
        atualizarPainelLoginAvaliacao(container, empresaId);
      } catch (erro) {
        botao.disabled = false;
        botao.textContent = textoOriginal;
        alert('Não foi possível entrar com o Google. Tente novamente.');
        console.error(erro);
      }
    });
  });

  container.querySelectorAll('[data-notas-empresa]').forEach((grupo) => {
    grupo.querySelectorAll('.nota-btn').forEach((botaoNota) => {
      botaoNota.addEventListener('click', () => {
        grupo.querySelectorAll('.nota-btn').forEach((b) => {
          b.style.background = '';
          b.style.color = '';
        });
        botaoNota.style.background = '#16a34a';
        botaoNota.style.color = '#fff';
        grupo.dataset.notaSelecionada = botaoNota.dataset.notaValor;

        const empresaId = grupo.dataset.notasEmpresa;
        const botaoEnviar = container.querySelector(`[data-enviar-avaliacao="${empresaId}"]`);
        if (botaoEnviar) botaoEnviar.disabled = false;
      });
    });
  });

  container.querySelectorAll('[data-enviar-avaliacao]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      const empresaId = botao.dataset.enviarAvaliacao;
      const grupo = container.querySelector(`[data-notas-empresa="${empresaId}"]`);
      const nota = Number(grupo?.dataset.notaSelecionada);
      const comentario = (container.querySelector(`#avaliar-comentario-${empresaId}`)?.value || '').trim();
      const chaveLocal = `tra-avaliou-${empresaId}`;
      const painel = container.querySelector(`#avaliar-notas-${empresaId}`);

      if (localStorage.getItem(chaveLocal)) {
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Você já avaliou esta empresa neste dispositivo. Obrigado! 🙌</p>`;
        }
        return;
      }

      const usuario = usuarioAtual();
      if (!usuario) {
        atualizarPainelLoginAvaliacao(container, empresaId);
        return;
      }

      if (!nota) return;

      botao.disabled = true;
      botao.textContent = 'Enviando...';

      try {
        await avaliarEmpresa(empresaId, nota, comentario, usuario);
        localStorage.setItem(chaveLocal, '1');
        const primeiroNome = (usuario.displayName || '').split(' ')[0];
        if (painel) {
          painel.innerHTML = `<p class="card-empresa__avaliar-obrigado">Obrigado pela avaliação${primeiroNome ? ', ' + primeiroNome : ''}! 🙌</p>`;
        }
      } catch (erro) {
        botao.disabled = false;
        botao.textContent = 'Enviar avaliação';
        console.error(erro);
        alert('Não foi possível registrar agora. Tente novamente.');
      }
    });
  });
}

/** Mostra o painel de login ou o formulário de nota, dependendo se já está logado com Google. */
function atualizarPainelLoginAvaliacao(container, empresaId) {
  const loginDiv = container.querySelector(`#avaliar-login-${empresaId}`);
  const formDiv = container.querySelector(`#avaliar-form-${empresaId}`);
  if (!loginDiv || !formDiv) return;
  const logado = Boolean(usuarioAtual());
  loginDiv.hidden = logado;
  formDiv.hidden = !logado;
}

async function carregarUltimasAvaliacoes(container, categoria) {
  const alvo = container.querySelector('#ultimas-avaliacoes-categoria');
  if (!alvo) return;
  try {
    const avaliacoes = await buscarUltimasAvaliacoes(6, categoria);
    if (avaliacoes.length === 0) {
      alvo.closest('.home-secao')?.remove();
      return;
    }
    alvo.innerHTML = avaliacoes.map(renderCardAvaliacao).join('');
  } catch (erro) {
    alvo.closest('.home-secao')?.remove();
    console.error(erro);
  }
}

