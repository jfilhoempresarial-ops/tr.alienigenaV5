import { cadastrarEmpresa } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';

export function renderCadastroEmpresa(container) {
  container.innerHTML = `
    <section class="cadastro">
      <h2>Cadastrar minha empresa</h2>
      <form id="form-cadastro">
        <label>Nome da empresa <input name="nome" required /></label>
        <label>WhatsApp <input name="whatsapp" required placeholder="(88) 99999-9999" /></label>
        <label>Endereço <input name="endereco" required /></label>
        <label>
          Categoria
          <select name="categoria" required>
            <option value="mecanico">Mecânico</option>
            <option value="posto">Posto</option>
            <option value="borracharia">Borracharia</option>
            <option value="eletrica">Elétrica</option>
            <option value="guincho">Guincho/Socorro</option>
            <option value="pontoapoio">Ponto de Apoio</option>
            <option value="lavajato">Lava-Jato</option>
            <option value="autopecas">Auto Peças</option>
          </select>
        </label>
        <label><input type="checkbox" name="disponivel24h" /> Funciona 24h</label>
        <label><input type="checkbox" name="atendeCarreta" /> Atende carreta/veículo pesado</label>
        <button type="submit">Enviar cadastro</button>
      </form>
      <p id="cadastro-status"></p>
    </section>
  `;

  document
    .getElementById('form-cadastro')
    .addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('cadastro-status');
      status.textContent = 'Enviando...';

      try {
        const formData = new FormData(event.target);
        const localizacao = await obterLocalizacaoAtual();

        await cadastrarEmpresa({
          nome: formData.get('nome'),
          whatsapp: formData.get('whatsapp'),
          endereco: formData.get('endereco'),
          categorias: [formData.get('categoria')],
          disponivel24h: formData.get('disponivel24h') === 'on',
          atendeCarreta: formData.get('atendeCarreta') === 'on',
          location: localizacao,
        });

        status.textContent = 'Cadastro enviado! Sua empresa será revisada em breve.';
        event.target.reset();
      } catch (erro) {
        status.textContent = 'Erro ao enviar. Tente novamente.';
        console.error(erro);
      }
    });
}
