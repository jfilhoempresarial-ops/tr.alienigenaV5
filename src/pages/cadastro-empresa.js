import { cadastrarEmpresa } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';

const CLOUDINARY_CLOUD_NAME = 'djajspfnl';
const CLOUDINARY_UPLOAD_PRESET = 'tralienigena_unsigned';

const CATEGORIAS_CADASTRO = [
  { id: 'mecanico', label: 'Mecânico' },
  { id: 'posto', label: 'Posto/Conveniência' },
  { id: 'borracharia', label: 'Borracharia' },
  { id: 'eletrica', label: 'Elétrica' },
  { id: 'guincho', label: 'Guincho/Socorro' },
  { id: 'pontoapoio', label: 'Ponto de Apoio' },
  { id: 'lavajato', label: 'Lava-Jato' },
  { id: 'autopecas', label: 'Auto Peças' },
  { id: 'tacografo', label: 'Tacógrafo' },
];

const MAX_FOTOS = 3;

export function renderCadastroEmpresa(container) {
  container.innerHTML = `
    <section class="cadastro">
      <h2>Cadastrar minha empresa</h2>
      <form id="form-cadastro">
        <label>Nome da empresa <input name="nome" required /></label>

        <label>Telefone (fixo, se tiver) <input name="telefone" placeholder="(88) 3333-4444" /></label>
        <label>WhatsApp <input name="whatsapp" required placeholder="(88) 99999-9999" /></label>
        <label>Instagram (opcional) <input name="instagram" placeholder="@suaempresa" /></label>

        <label>
          Endereço completo (rua, número, bairro e CEP)
          <input name="endereco" id="cadastro-endereco" required placeholder="Rua, número, bairro, cidade - CEP" />
        </label>
        <button type="button" id="btn-usar-localizacao" class="cadastro__botao-localizacao">
          📍 Usar minha localização atual
        </button>
        <p class="cadastro__ajuda-endereco">
          Se não souber o endereço certinho ou estiver com preguiça de digitar, use o botão acima —
          a gente marca sua localização exata no mapa automaticamente. Caso contrário, capriche nos detalhes do endereço!
        </p>
        <p id="localizacao-status" class="cadastro__localizacao-status"></p>

        <label>
          Categoria
          <select name="categoria" required>
            ${CATEGORIAS_CADASTRO.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
          </select>
        </label>

        <label><input type="checkbox" name="disponivel24h" /> Funciona 24h</label>
        <label><input type="checkbox" name="atendeCarreta" /> Atende carreta/veículo pesado</label>

        <label>
          Fotos do local (até 3)
          <input type="file" name="fotos" id="cadastro-fotos" accept="image/*" multiple />
        </label>
        <p class="cadastro__ajuda-endereco" id="fotos-info"></p>

        <button type="submit">Enviar cadastro</button>
      </form>
      <p id="cadastro-status"></p>
    </section>
  `;

  let coordenadasDaLocalizacao = null; // preenchido só se o motorista usar o botão de localização

  const inputFotos = document.getElementById('cadastro-fotos');
  const fotosInfo = document.getElementById('fotos-info');
  inputFotos.addEventListener('change', () => {
    if (inputFotos.files.length > MAX_FOTOS) {
      fotosInfo.textContent = `Você selecionou ${inputFotos.files.length} fotos, mas o máximo é ${MAX_FOTOS}. Só as primeiras ${MAX_FOTOS} serão enviadas.`;
    } else {
      fotosInfo.textContent = inputFotos.files.length
        ? `${inputFotos.files.length} foto(s) selecionada(s).`
        : '';
    }
  });

  document.getElementById('btn-usar-localizacao').addEventListener('click', async () => {
    const status = document.getElementById('localizacao-status');
    status.textContent = '📡 Buscando sua localização...';
    try {
      const localizacao = await obterLocalizacaoAtual();
      coordenadasDaLocalizacao = localizacao;

      // Tenta preencher o campo de endereço automaticamente (reverse geocoding).
      // Se não conseguir, não tem problema — as coordenadas já foram salvas.
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${localizacao.lat}&lon=${localizacao.lng}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();
        if (dados && dados.display_name) {
          document.getElementById('cadastro-endereco').value = dados.display_name;
        }
      } catch (erroReverso) {
        console.warn('Não foi possível preencher o endereço automaticamente:', erroReverso);
      }

      status.textContent = '✅ Localização atual capturada com sucesso!';
    } catch (erro) {
      status.textContent = '❌ Não foi possível pegar sua localização. Verifique a permissão do navegador.';
      console.error(erro);
    }
  });

  document
    .getElementById('form-cadastro')
    .addEventListener('submit', async (event) => {
      event.preventDefault();
      const status = document.getElementById('cadastro-status');
      status.textContent = 'Localizando endereço...';

      try {
        const formData = new FormData(event.target);
        const endereco = formData.get('endereco');

        // Se o motorista já usou o botão "usar localização atual", usamos essas
        // coordenadas direto. Senão, geocodificamos o endereço digitado.
        const coordenadas = coordenadasDaLocalizacao || (await geocodificarEndereco(endereco));

        status.textContent = 'Enviando fotos...';
        const arquivos = Array.from(inputFotos.files).slice(0, MAX_FOTOS);
        const fotosUrls = await enviarFotos(arquivos);

        status.textContent = 'Enviando cadastro...';

        await cadastrarEmpresa({
          nome: formData.get('nome'),
          telefone: formData.get('telefone') || '',
          whatsapp: formData.get('whatsapp'),
          instagram: (formData.get('instagram') || '').replace(/^@/, ''),
          endereco,
          categorias: [formData.get('categoria')],
          disponivel24h: formData.get('disponivel24h') === 'on',
          atendeCarreta: formData.get('atendeCarreta') === 'on',
          fotos: fotosUrls,
          ...(coordenadas ? { lat: coordenadas.lat, lng: coordenadas.lng } : {}),
        });

        status.textContent = coordenadas
          ? 'Cadastro enviado! Sua empresa será revisada em breve.'
          : 'Cadastro enviado! Não conseguimos localizar esse endereço no mapa automaticamente, mas nossa equipe ajusta isso na revisão.';
        event.target.reset();
        coordenadasDaLocalizacao = null;
        fotosInfo.textContent = '';
        document.getElementById('localizacao-status').textContent = '';
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

/** Sobe até 3 fotos pro Cloudinary (upload sem assinatura) e retorna a lista de URLs públicas. */
async function enviarFotos(arquivos) {
  if (!arquivos || arquivos.length === 0) return [];

  const urls = [];
  for (const arquivo of arquivos) {
    const formData = new FormData();
    formData.append('file', arquivo);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('folder', 'cadastro-empresas');

    const resposta = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!resposta.ok) {
      throw new Error('Falha ao enviar uma das fotos pro Cloudinary.');
    }

    const dados = await resposta.json();
    urls.push(dados.secure_url);
  }
  return urls;
}