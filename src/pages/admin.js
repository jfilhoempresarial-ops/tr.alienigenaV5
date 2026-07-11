import { fazerLogin, fazerLogout, observarAutenticacao } from '../services/auth.service.js';
import { criarEvento } from '../services/eventos.service.js';

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
}
