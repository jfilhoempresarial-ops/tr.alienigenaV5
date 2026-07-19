import { fazerLogin, fazerLogout, observarAutenticacao } from '../services/auth.service.js';
import { criarEvento } from '../services/eventos.service.js';
import { buscarVagas } from '../services/vagas.service.js';
import { buscarTodasEmpresas } from '../services/empresas.service.js';

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

    const todasCidades = Array.from(cidadesMapa.values()).sort((a, b) => a.localeCompare(b));

    if (todasCidades.length === 0) {
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

    alvo.innerHTML = `
      <div class="cobertura-tabela-scroll">
        <table class="cobertura-tabela">
          <thead>
            <tr>
              <th>Cidade</th>
              ${CATEGORIAS_COBERTURA.map((c) => `<th>${c.label}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${todasCidades
              .map((cidade) => {
                const cidadeNorm = normalizarCidade(cidade);
                const linha = contagem[cidadeNorm] || {};
                return `
                  <tr>
                    <td class="cobertura-tabela__cidade">${cidade}</td>
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