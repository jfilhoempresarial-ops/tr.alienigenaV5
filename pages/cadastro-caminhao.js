import { cadastrarCaminhao } from '../services/caminhoes.service.js';

export function renderCadastroCaminhao(container) {
  container.innerHTML = `
    <section class="cadastro">
      <h2>Anunciar meu caminhão</h2>
      <form id="form-caminhao">
        <label>Modelo <input name="modelo" required placeholder="Ex: Volvo FH 460" /></label>
        <label>Ano <input name="ano" type="number" required /></label>
        <label>Preço (R$) <input name="preco" required placeholder="Ex: 250.000" /></label>
        <label>Cidade <input name="cidade" required /></label>
        <label>UF <input name="uf" maxlength="2" required placeholder="Ex: CE" /></label>
        <label>WhatsApp <input name="whatsapp" required placeholder="(88) 99999-9999" /></label>
        <label>URL da foto (Cloudinary) <input name="fotoUrl" /></label>
        <button type="submit">Enviar anúncio</button>
      </form>
      <p id="cadastro-status"></p>
    </section>
  `;

  document.getElementById('form-caminhao').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('cadastro-status');
    status.textContent = 'Enviando...';

    try {
      const formData = new FormData(event.target);
      await cadastrarCaminhao({
        modelo: formData.get('modelo'),
        ano: formData.get('ano'),
        preco: formData.get('preco'),
        cidade: formData.get('cidade'),
        uf: formData.get('uf'),
        whatsapp: formData.get('whatsapp'),
        fotoUrl: formData.get('fotoUrl'),
      });
      status.textContent = 'Anúncio enviado! Será revisado antes de aparecer no site.';
      event.target.reset();
    } catch (erro) {
      status.textContent = 'Erro ao enviar. Tente novamente.';
      console.error(erro);
    }
  });
}
