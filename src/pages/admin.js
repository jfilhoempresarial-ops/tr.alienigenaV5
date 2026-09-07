import { fazerLogin, fazerLogout, observarAutenticacao } from '../services/auth.service.js';
import { criarEvento } from '../services/eventos.service.js';
import { buscarEmpresasPendentes, aprovarEmpresa, recusarEmpresa } from '../services/empresas.service.js';
import { otimizarFotoCloudinary } from '../utils/cloudinary.js';

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
              ${empresa.fotos
                .map(
                  (url) =>
                    `<img src="${otimizarFotoCloudinary(url, { largura: 300, altura: 220 })}" alt="" class="admin-pendente-card__foto" style="width:150px;height:110px;object-fit:cover;border-radius:8px;" />`
                )
                .join('')}
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
