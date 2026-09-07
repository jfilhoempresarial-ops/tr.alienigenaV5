import { fazerLogin, fazerLogout, observarAutenticacao } from '../services/auth.service.js';
import { criarEvento } from '../services/eventos.service.js';
import { buscarVagas } from '../services/vagas.service.js';
import { buscarTodasEmpresas, buscarEmpresasPendentes, aprovarEmpresa, recusarEmpresa } from '../services/empresas.service.js';

// Mesma lista de categorias usada no resto do site (home.js), pra bater
// certinho com o campo "categorias" salvo em cada empresa.
const CATEGORIAS_COBERTURA = [
  { id: 'mecanico', label: 'Mecânico' },
  { id: 'posto', label: 'Posto/Conveniência' },
  { id: 'borracharia', label: 'Borracharia' },
  { id: 'eletrica', label: 'Elétrica' },
  { id: 'guincho', label: 'Guincho' },
  { id: 'pontoapoio', label: 'P. Apoio' },
  { id: 'lavajato', label: 'Lava-Jato' },
  { id: 'autopecas', label: 'Auto Peças' },
  { id: 'tacografo', label: 'Tacógrafo' },
];

export function renderAdmin(container) {
  observarAutenticacao((usuario) => {
    if (usuario) {
      renderPainel(container, usuario);
    } else {
      renderLogin(container);
    }
  });
}

function renderLogin(container) {
  container.innerHTML = `
    <section class="admin-login">
      <h2>Área do Admin</h2>
      <form id="form-login">
        <label>E-mail <input type="email" name="email" required /></label>
        <label>Senha <input type="password" name="senha" required /></label>
        <button type="submit">Entrar</button>
      </form>
      <p id="login-status"></p>
    </section>
  `;

  document.getElementById('form-login').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('login-status');
    status.textContent = 'Entrando...';

    const formData = new FormData(event.target);
    try {
      await fazerLogin(formData.get('email'), formData.get('senha'));
    } catch (erro) {
      status.textContent = 'E-mail ou senha incorretos.';
      console.error(erro);
    }
  });
}

function renderPainel(container, usuario) {
  container.innerHTML = `
    <section class="admin-painel">
      <div class="admin-painel__header">
        <span>Logado como ${usuario.email}</span>
        <button id="btn-logout" class="btn-secundario">Sair</button>
      </div>

      <h2>Cadastrar evento (Truck Fest)</h2>
      <form id="form-evento">
        <label>Título <input name="titulo" required /></label>
        <label>Data <input type="date" name="data" required /></label>
        <label>Local <input name="local" /></label>
        <label>Descrição <textarea name="descricao" rows="3"></textarea></label>
        <label>URL da imagem (Cloudinary) <input name="imagemUrl" /></label>
        <label>Link (mais informações) <input name="link" /></label>
        <button type="submit">Salvar evento</button>
      </form>
      <p id="evento-status"></p>

      <h2 class="admin-painel__titulo-cobertura">📋 Cadastros pendentes de aprovação</h2>
      <p class="admin-painel__subtitulo-cobertura">
        Empresas que vieram pelo formulário "Cadastrar minha empresa" no site. Aprovar já coloca a
        empresa no ar na hora; recusar apaga o cadastro (spam, dado incompleto, duplicado etc).
      </p>
      <div id="pendentes-lista">
        <p class="loading">Carregando pendentes...</p>
      </div>

      <h2 class="admin-painel__titulo-cobertura">📊 Cobertura de prestadores por cidade (SINE)</h2>
      <p class="admin-painel__subtitulo-cobertura">
        Cidades com vaga do SINE + cidades que já têm prestador cadastrado, cruzadas com quantos
        prestadores existem em cada categoria. Células em vermelho = categoria sem nenhum prestador nessa cidade.
      </p>
      <div id="cobertura-tabela">
        <p class="loading">Carregando cobertura...</p>
      </div>
    </section>
  `;

  document.getElementById('btn-logout').addEventListener('click', fazerLogout);

  document.getElementById('form-evento').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('evento-status');
    status.textContent = 'Salvando...';

    const formData = new FormData(event.target);
    try {
      await criarEvento({
        titulo: formData.get('titulo'),
        data: formData.get('data'),
        local: formData.get('local'),
        descricao: formData.get('descricao'),
        imagemUrl: formData.get('imagemUrl'),
        link: formData.get('link'),
      });
      status.textContent = 'Evento salvo com sucesso!';
      event.target.reset();
    } catch (erro) {
      status.textContent = 'Erro ao salvar. Tente novamente.';
      console.error(erro);
    }
  });

  carregarPendentes(container);
  carregarCoberturaPorCidade(container);
}

function normalizarCidade(texto) {
  return (texto || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// A cidade do SINE às vezes vem como "Fortaleza - U.a. Messejana" (cidade + unidade/bairro).
// Aqui ficamos só com a parte antes do " - ", que é a cidade de verdade.
function extrairCidadeBase(texto) {
  return (texto || '').split(' - ')[0].trim();
}

// Padroniza a capitalização (ex: "juazeiro do norte" -> "Juazeiro Do Norte"), pra
// duas grafias diferentes da mesma cidade não virarem duas linhas na tabela.
function capitalizarCidade(texto) {
  return (texto || '')
    .trim()
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letra) => letra.toUpperCase());
}

async function carregarPendentes(container) {
  const alvo = container.querySelector('#pendentes-lista');

  try {
    const pendentes = await buscarEmpresasPendentes();

    if (pendentes.length === 0) {
      alvo.innerHTML = `<p class="vazio">Nenhum cadastro pendente no momento. 🎉</p>`;
      return;
    }

    alvo.innerHTML = pendentes.map((empresa) => renderCardPendente(empresa)).join('');

    alvo.querySelectorAll('[data-aprovar]').forEach((botao) => {
      botao.addEventListener('click', () => processarPendente(botao, alvo, aprovarEmpresa, 'Aprovando...'));
    });
    alvo.querySelectorAll('[data-recusar]').forEach((botao) => {
      botao.addEventListener('click', () => {
        if (!confirm('Recusar e apagar esse cadastro? Não tem como desfazer.')) return;
        processarPendente(botao, alvo, recusarEmpresa, 'Recusando...');
      });
    });
  } catch (erro) {
    alvo.innerHTML = `<p class="erro">Não foi possível carregar os pendentes agora.</p>`;
    console.error(erro);
  }
}

function renderCardPendente(empresa) {
  const id = empresa.id;
  const categorias = (empresa.categorias || []).join(', ') || '-';
  return `
    <div class="admin-pendente-card" id="pendente-${id}">
      <p class="admin-pendente-card__nome">${empresa.nome || '(sem nome)'}</p>
      <p class="admin-pendente-card__linha">📍 ${empresa.endereco || '-'}</p>
      <p class="admin-pendente-card__linha">🏷️ ${categorias}</p>
      <p class="admin-pendente-card__linha">💬 ${empresa.whatsapp || '-'} ${empresa.telefone ? `| ☎️ ${empresa.telefone}` : ''}</p>
      ${empresa.instagram ? `<p class="admin-pendente-card__linha">📸 @${empresa.instagram}</p>` : ''}
      ${empresa.especialidades ? `<p class="admin-pendente-card__linha">✏️ ${empresa.especialidades}</p>` : ''}
      ${
        (empresa.fotos || []).length > 0
          ? `<div class="admin-pendente-card__fotos">
              ${empresa.fotos.map((url) => `<img src="${url}" alt="" class="admin-pendente-card__foto" />`).join('')}
            </div>`
          : ''
      }
      <div class="admin-pendente-card__acoes">
        <button class="btn-primario" data-aprovar="${id}">✅ Aprovar</button>
        <button class="btn-secundario" data-recusar="${id}">🗑️ Recusar</button>
      </div>
    </div>
  `;
}

async function processarPendente(botao, alvo, acao, textoCarregando) {
  const id = botao.dataset.aprovar || botao.dataset.recusar;
  const card = alvo.querySelector(`#pendente-${id}`);
  const botoes = card.querySelectorAll('button');
  botoes.forEach((b) => (b.disabled = true));
  botao.textContent = textoCarregando;

  try {
    await acao(id);
    card.remove();
    if (!alvo.querySelector('.admin-pendente-card')) {
      alvo.innerHTML = `<p class="vazio">Nenhum cadastro pendente no momento. 🎉</p>`;
    }
  } catch (erro) {
    botoes.forEach((b) => (b.disabled = false));
    alert('Não foi possível concluir. Tente novamente.');
    console.error(erro);
  }
}

async function carregarCoberturaPorCidade(container) {
  const alvo = container.querySelector('#cobertura-tabela');

  try {
    const [dadosVagas, empresas] = await Promise.all([buscarVagas(), buscarTodasEmpresas()]);

    // Cidades do SINE (só o nome da cidade, sem bairro/unidade)
    const cidadesSine = (dadosVagas.itens || []).map((v) => extrairCidadeBase(v.cidade)).filter(Boolean);

    // Cidades que já têm pelo menos uma empresa cadastrada
    const cidadesComEmpresa = empresas.map((e) => extrairCidadeBase(e.cidade)).filter(Boolean);

    // União das duas listas, agrupando por nome normalizado (sem acento/maiúscula)
    // pra "Juazeiro do norte" e "Juazeiro do Norte" virarem uma linha só.
    const cidadesMapa = new Map(); // chave normalizada -> nome padronizado pra exibir
    [...cidadesSine, ...cidadesComEmpresa].forEach((cidadeBruta) => {
      const nomePadronizado = capitalizarCidade(cidadeBruta);
      const chave = normalizarCidade(nomePadronizado);
      if (chave && !cidadesMapa.has(chave)) {
        cidadesMapa.set(chave, nomePadronizado);
      }
    });

    const todasCidadesBrutas = Array.from(cidadesMapa.values());

    if (todasCidadesBrutas.length === 0) {
      alvo.innerHTML = `<p class="vazio">Nenhuma cidade encontrada ainda (nem em vagas, nem em empresas).</p>`;
      return;
    }

    // Monta um contador: contagem[cidadeNormalizada][categoria] = quantidade
    const contagem = {};
    empresas.forEach((empresa) => {
      const cidadeNorm = normalizarCidade(extrairCidadeBase(empresa.cidade));
      if (!cidadeNorm) return;
      if (!contagem[cidadeNorm]) contagem[cidadeNorm] = {};
      (empresa.categorias || []).forEach((cat) => {
        contagem[cidadeNorm][cat] = (contagem[cidadeNorm][cat] || 0) + 1;
      });
    });

    // Soma o total de prestadores de cada cidade, pra ordenar quem tem
    // MENOS cobertura primeiro — assim dá pra ver de cara onde focar o
    // cadastro de novos prestadores.
    const totalPorCidade = (cidade) =>
      Object.values(contagem[normalizarCidade(cidade)] || {}).reduce((soma, qtd) => soma + qtd, 0);

    const todasCidades = todasCidadesBrutas.sort((a, b) => {
      const diferenca = totalPorCidade(a) - totalPorCidade(b);
      return diferenca !== 0 ? diferenca : a.localeCompare(b);
    });

    alvo.innerHTML = `
      <div class="cobertura-tabela-scroll">
        <table class="cobertura-tabela">
          <thead>
            <tr>
              <th>Cidade</th>
              <th>Total</th>
              ${CATEGORIAS_COBERTURA.map((c) => `<th>${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${todasCidades
              .map((cidade) => {
                const cidadeNorm = normalizarCidade(cidade);
                const linha = contagem[cidadeNorm] || {};
                const total = Object.values(linha).reduce((soma, qtd) => soma + qtd, 0);
                return `
                  <tr>
                    <td class="cobertura-tabela__cidade">${cidade}</td>
                    <td class="cobertura-tabela__total">${total}</td>
                    ${CATEGORIAS_COBERTURA.map((c) => {
                      const qtd = linha[c.id] || 0;
                      return `<td class="${qtd === 0 ? 'cobertura-tabela__vazio' : ''}">${qtd}</td>`;
                    }).join('')}
                  </tr>
                `;
              })
              .join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (erro) {
    alvo.innerHTML = `<p class="erro">Não foi possível carregar a cobertura agora.</p>`;
    console.error(erro);
  }
}