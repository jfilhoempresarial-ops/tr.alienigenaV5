import { cadastrarEmpresa } from '../services/empresas.service.js';

const CATEGORIAS_CADASTRO = [
  { id: 'mecanico', label: 'Mecânico' },
  { id: 'posto', label: 'Posto' },
  { id: 'borracharia', label: 'Borracharia' },
  { id: 'eletrica', label: 'Elétrica' },
  { id: 'guincho', label: 'Guincho/Socorro' },
  { id: 'pontoapoio', label: 'Ponto de Apoio' },
  { id: 'lavajato', label: 'Lava-Jato' },
  { id: 'autopecas', label: 'Auto Peças' },
  { id: 'tacografo', label: 'Tacógrafo' },
];

export function renderCadastroEmpresa(container) {
  container.innerHTML = `
    <section class="cadastro">
      <h2>Cadastrar minha empresa</h2>
      <form id="form-cadastro">
        <label>Nome da empresa <input name="nome" required /></label>
        <label>WhatsApp <input name="whatsapp" required placeholder="(88) 99999-9999" /></label>
        <label>
          Endereço completo (com CEP)
          <input name="endereco" required placeholder="Rua, número, bairro, cidade - CEP" />
        </label>
        <p class="cadastro__ajuda-endereco">
          Usamos esse endereço pra te mostrar aos motoristas que estão perto de você. Capriche nos detalhes!
        </p>
        <label>
          Categoria
          <select name="categoria" required>
            ${CATEGORIAS_CADASTRO.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
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
      status.textContent = 'Localizando endereço...';

      try {
        const formData = new FormData(event.target);
        const endereco = formData.get('endereco');
        const coordenadas = await geocodificarEndereco(endereco);

        status.textContent = 'Enviando...';

        await cadastrarEmpresa({
          nome: formData.get('nome'),
          whatsapp: formData.get('whatsapp'),
          endereco,
          categorias: [formData.get('categoria')],
          disponivel24h: formData.get('disponivel24h') === 'on',
          atendeCarreta: formData.get('atendeCarreta') === 'on',
          ...(coordenadas ? { lat: coordenadas.lat, lng: coordenadas.lng } : {}),
        });

        status.textContent = coordenadas
          ? 'Cadastro enviado! Sua empresa será revisada em breve.'
          : 'Cadastro enviado! Não conseguimos localizar esse endereço no mapa automaticamente, mas nossa equipe ajusta isso na revisão.';
        event.target.reset();
      } catch (erro) {
        status.textContent = 'Erro ao enviar. Tente novamente.';
        console.error(erro);
      }
    });
}

/**
 * Converte o endereço digitado em latitude/longitude usando o Nominatim
 * (OpenStreetMap, gratuito). Se não encontrar, retorna null — o cadastro
 * segue mesmo assim, e a equipe pode geocodificar depois manualmente ou
 * rodando o script scripts/geocodificar-empresas.cjs.
 */
async function geocodificarEndereco(endereco) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(endereco)}`;
    const resposta = await fetch(url);
    if (!resposta.ok) return null;
    const dados = await resposta.json();
    if (dados.length === 0) return null;
    return { lat: parseFloat(dados[0].lat), lng: parseFloat(dados[0].lon) };
  } catch (erro) {
    console.warn('Não foi possível geocodificar o endereço:', erro);
    return null;
  }
}