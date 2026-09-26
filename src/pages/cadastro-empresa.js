import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { cadastrarEmpresa } from '../services/empresas.service.js';

const CLOUDINARY_CLOUD_NAME = 'djajspfnl';
const CLOUDINARY_UPLOAD_PRESET = 'tralienigena_unsigned';

// Credenciais do EmailJS (gratuito, envia e-mail direto do navegador, sem
// precisar de servidor/backend). Criar conta em https://www.emailjs.com,
// configurar um serviço de e-mail (ex: Gmail) e um template, e preencher
// essas 3 variáveis no arquivo .env — ver .env.example.
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const CATEGORIAS_CADASTRO = [
  { id: 'mecanico', label: 'Mecânico' },
  { id: 'posto', label: 'Posto/Conveniência' },
  { id: 'borracharia', label: 'Borracharia' },
  { id: 'eletrica', label: 'Elétrica' },
  { id: 'guincho', label: 'Guincho/Socorro' },
  { id: 'pontoapoio', label: 'Ponto de Apoio' },
  { id: 'lavajato', label: 'Lava-Jato' },
  { id: 'autopecas', label: 'Auto Peças' },
  { id: 'tacografo', label: 'Tacógrafo' },
  { id: 'molas', label: 'Molas e Suspensão' },
  { id: 'funilaria', label: 'Funilaria e Retífica' },
  { id: 'vidros', label: 'Vidros e Para-brisa' },
  { id: 'restaurante', label: 'Restaurante e Hospedagem' },
  // "Outros Serviços" usa o id 'financiamento' (é o id da página já existente
  // no site, /financiamento). Pra quem não se encaixa em nenhuma categoria.
  { id: 'financiamento', label: 'Outros Serviços' },
];

const ID_OUTROS_SERVICOS = 'financiamento';

// "Loja/Conveniência" aparece como opção SÓ no formulário de cadastro.
// Não é uma categoria nova no site: quem escolher entra na página de
// Outros Serviços, com "Loja/Conveniência" no começo das especialidades.
const ID_LOJA = 'loja';
const LABEL_LOJA = 'Loja/Conveniência';

// Lista de opções do formulário: as categorias do site + Loja/Conveniência,
// com "Outros Serviços" sempre por último. (O /admin continua usando
// CATEGORIAS_CADASTRO puro, sem a opção de loja.)
const OPCOES_FORMULARIO = [
  ...CATEGORIAS_CADASTRO.filter((c) => c.id !== ID_OUTROS_SERVICOS),
  { id: ID_LOJA, label: LABEL_LOJA },
  ...CATEGORIAS_CADASTRO.filter((c) => c.id === ID_OUTROS_SERVICOS),
];

const DIAS_SEMANA = [
  { id: 'seg', curto: 'Seg' },
  { id: 'ter', curto: 'Ter' },
  { id: 'qua', curto: 'Qua' },
  { id: 'qui', curto: 'Qui' },
  { id: 'sex', curto: 'Sex' },
  { id: 'sab', curto: 'Sáb' },
  { id: 'dom', curto: 'Dom' },
];

const MAX_FOTOS = 3;
const MAX_CATEGORIAS_EXTRAS = 3;

/**
 * categoriaTravada: vem da URL (?categoria=mecanico), quando o motorista
 * clica em "cadastre grátis" dentro de uma categoria específica. Nesse
 * caso essa categoria fica fixa (não pode ser trocada), e ele só escolhe
 * categorias ADICIONAIS (até 3) nas quais também atua.
 */
export function renderCadastroEmpresa(container, categoriaTravada) {
  const categoriaInfo = OPCOES_FORMULARIO.find((c) => c.id === categoriaTravada);

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

        ${
          categoriaInfo
            ? `
          <label>Categoria principal</label>
          <div class="cadastro__categoria-travada">${categoriaInfo.label} 🔒</div>
          <input type="hidden" name="categoriaPrincipal" value="${categoriaInfo.id}" />
        `
            : `
          <label>
            Categoria principal
            <select name="categoriaPrincipal" required>
              ${OPCOES_FORMULARIO.map((c) => `<option value="${c.id}">${c.label}</option>`).join('')}
            </select>
          </label>
        `
        }

        <p class="cadastro__label-extra">Também atua em outras áreas? Escolha até ${MAX_CATEGORIAS_EXTRAS}:</p>
        <div class="cadastro__categorias-extras" id="categorias-extras">
          ${OPCOES_FORMULARIO.filter((c) => c.id !== categoriaTravada)
            .map(
              (c) => `
            <label class="cadastro__categoria-extra-item">
              <input type="checkbox" name="categoriasExtras" value="${c.id}" />
              ${c.label}
            </label>
          `
            )
            .join('')}
        </div>

        <label>
          <span id="especialidades-titulo">Especialidades (opcional)</span>
          <textarea name="especialidades" id="cadastro-especialidades" rows="3" placeholder="Ex: mexo com mola, sou bom em injeção eletrônica, troco embreagem rápido..."></textarea>
        </label>

        <fieldset class="cadastro__horario">
          <legend>Horário de atendimento</legend>

          <label class="cadastro__horario-24h">
            <input type="checkbox" name="funciona24h" id="cadastro-24h" />
            <span>🕐 Funciona 24 horas</span>
          </label>

          <div id="cadastro-horario-detalhes">
            <p class="cadastro__label-extra">Dias em que atende:</p>
            <div class="cadastro__dias">
              ${DIAS_SEMANA.map(
                (d) => `
                <label class="cadastro__dia">
                  <input type="checkbox" name="diasAtendimento" value="${d.id}" />
                  <span>${d.curto}</span>
                </label>
              `
              ).join('')}
            </div>
            <div class="cadastro__horas">
              <label>Abre às <input type="time" name="horaAbre" /></label>
              <label>Fecha às <input type="time" name="horaFecha" /></label>
            </div>
          </div>
        </fieldset>

        <label>
          Fotos do local (até ${MAX_FOTOS})
          <input type="file" name="fotos" id="cadastro-fotos" accept="image/*" multiple />
        </label>
        <p class="cadastro__ajuda-endereco" id="fotos-info"></p>

        <button type="submit">Enviar cadastro</button>
      </form>
      <p id="cadastro-status"></p>
    </section>
  `;

  // Quem escolhe "Outros Serviços" precisa dizer QUAL serviço oferece —
  // senão o cadastro chega sem informação nenhuma do que a empresa faz.
  const selectPrincipal = container.querySelector('select[name="categoriaPrincipal"]');
  const campoEspecialidades = container.querySelector('#cadastro-especialidades');
  const tituloEspecialidades = container.querySelector('#especialidades-titulo');
  const placeholderOriginal = campoEspecialidades ? campoEspecialidades.placeholder : '';

  function ajustarCampoEspecialidades() {
    if (!campoEspecialidades) return;
    const principal = selectPrincipal ? selectPrincipal.value : categoriaTravada;
    const ehOutros = principal === ID_OUTROS_SERVICOS;
    const ehLoja = principal === ID_LOJA;
    campoEspecialidades.required = ehOutros;
    if (ehOutros) {
      tituloEspecialidades.textContent = 'Qual serviço você oferece? (obrigatório)';
      campoEspecialidades.placeholder = 'Ex: despachante, ar-condicionado automotivo, radiador, capotaria, carroceria...';
    } else if (ehLoja) {
      tituloEspecialidades.textContent = 'O que a sua loja vende? (opcional)';
      campoEspecialidades.placeholder = 'Ex: acessórios para caminhão, peças, bebidas, lanches, itens para cabine...';
    } else {
      tituloEspecialidades.textContent = 'Especialidades (opcional)';
      campoEspecialidades.placeholder = placeholderOriginal;
    }
  }

  if (selectPrincipal) selectPrincipal.addEventListener('change', ajustarCampoEspecialidades);
  ajustarCampoEspecialidades();

  // "Funciona 24 horas" marcado → esconde dias e horários (não precisa).
  const checkbox24h = container.querySelector('#cadastro-24h');
  const detalhesHorario = container.querySelector('#cadastro-horario-detalhes');
  function ajustarHorario() {
    const eh24h = checkbox24h.checked;
    detalhesHorario.hidden = eh24h;
    detalhesHorario.querySelectorAll('input').forEach((campo) => {
      campo.disabled = eh24h;
    });
  }
  checkbox24h.addEventListener('change', ajustarHorario);
  ajustarHorario();

  let coordenadasDaLocalizacao = null; // preenchido só se o motorista usar o botão de localização

  // Limita a seleção de categorias extras a MAX_CATEGORIAS_EXTRAS
  const checkboxesExtras = container.querySelectorAll('input[name="categoriasExtras"]');
  checkboxesExtras.forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const marcados = container.querySelectorAll('input[name="categoriasExtras"]:checked');
      if (marcados.length > MAX_CATEGORIAS_EXTRAS) {
        checkbox.checked = false;
      }
    });
  });

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

      const horario = lerHorario(new FormData(event.target));
      if (horario.erro) {
        status.textContent = `⚠️ ${horario.erro}`;
        detalhesHorario.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      status.textContent = 'Localizando endereço...';

      try {
        const formData = new FormData(event.target);
        const endereco = formData.get('endereco');
        const categoriaPrincipal = formData.get('categoriaPrincipal');
        const categoriasExtras = formData.getAll('categoriasExtras');
        const escolhidas = [categoriaPrincipal, ...categoriasExtras];

        // Loja/Conveniência vira "Outros Serviços" no site (sem repetir).
        const ehLoja = escolhidas.includes(ID_LOJA);
        const categorias = [
          ...new Set(escolhidas.map((id) => (id === ID_LOJA ? ID_OUTROS_SERVICOS : id))),
        ];
        let especialidades = (formData.get('especialidades') || '').trim();
        if (ehLoja) {
          especialidades = especialidades ? `${LABEL_LOJA}: ${especialidades}` : LABEL_LOJA;
        }

        // Se o motorista já usou o botão "usar localização atual", usamos essas
        // coordenadas direto. Senão, geocodificamos o endereço digitado.
        const coordenadas = coordenadasDaLocalizacao || (await geocodificarEndereco(endereco));

        status.textContent = 'Enviando fotos...';
        const arquivos = Array.from(inputFotos.files).slice(0, MAX_FOTOS);
        const fotosUrls = await enviarFotos(arquivos);

        status.textContent = 'Enviando cadastro...';
        const labelsCategorias = escolhidas.map((id) =>
          id === ID_LOJA
            ? `${LABEL_LOJA} (Outros Serviços)`
            : OPCOES_FORMULARIO.find((c) => c.id === id)?.label || id
        );

        // Grava no Firestore como pendente (verificado: false) — some da fila
        // assim que o admin aprovar em /admin. Continua mandando o e-mail
        // de aviso também, pra o admin saber na hora que chegou um cadastro novo.
        await cadastrarEmpresa({
          nome: formData.get('nome'),
          telefone: formData.get('telefone') || '',
          whatsapp: formData.get('whatsapp'),
          instagram: (formData.get('instagram') || '').replace(/^@/, ''),
          endereco,
          categorias,
          especialidades,
          horario: horario.dados,
          horarioTexto: horario.texto,
          fotos: fotosUrls,
          lat: coordenadas?.lat ?? null,
          lng: coordenadas?.lng ?? null,
        });

        await enviarEmailNotificacao({
          nome: formData.get('nome'),
          telefone: formData.get('telefone') || '',
          whatsapp: formData.get('whatsapp'),
          instagram: (formData.get('instagram') || '').replace(/^@/, ''),
          endereco,
          labelsCategorias,
          especialidades,
          horarioTexto: horario.texto,
          fotosUrls,
          coordenadas,
        });

        status.textContent = 'Cadastro enviado! Nossa equipe vai revisar e incluir sua empresa em breve.';
        event.target.reset();
        coordenadasDaLocalizacao = null;
        fotosInfo.textContent = '';
        document.getElementById('localizacao-status').textContent = '';
        ajustarHorario();
        ajustarCampoEspecialidades();
      } catch (erro) {
        status.textContent = 'Erro ao enviar. Tente novamente.';
        console.error(erro);
      }
    });
}

/**
 * Lê o bloco "Horário de atendimento" do formulário.
 * Retorna { dados, texto } ou { erro } se faltar alguma informação.
 *   dados: o que vai pro Firestore (campo "horario")
 *   texto: resumo legível, ex: "Seg a Sex, das 07:00 às 18:00"
 */
function lerHorario(formData) {
  if (formData.get('funciona24h')) {
    return { dados: { funciona24h: true }, texto: '24 horas, todos os dias' };
  }
  const dias = formData.getAll('diasAtendimento');
  const abre = formData.get('horaAbre');
  const fecha = formData.get('horaFecha');
  if (dias.length === 0) {
    return { erro: 'Horário de atendimento: marque os dias em que atende ou "Funciona 24 horas".' };
  }
  if (!abre || !fecha) {
    return { erro: 'Horário de atendimento: informe a hora que abre e a hora que fecha.' };
  }
  return {
    dados: { funciona24h: false, dias, abre, fecha },
    texto: `${resumirDias(dias)}, das ${abre} às ${fecha}`,
  };
}

/** Junta dias seguidos: [seg,ter,qua,qui,sex] → "Seg a Sex"; [seg,qua] → "Seg, Qua". */
function resumirDias(ids) {
  const indices = ids
    .map((id) => DIAS_SEMANA.findIndex((d) => d.id === id))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b);
  if (indices.length === 7) return 'Todos os dias';

  const grupos = [];
  let inicio = indices[0];
  let anterior = indices[0];
  for (let k = 1; k <= indices.length; k++) {
    const atual = indices[k];
    if (atual === anterior + 1) {
      anterior = atual;
      continue;
    }
    grupos.push([inicio, anterior]);
    inicio = atual;
    anterior = atual;
  }

  return grupos
    .map(([a, b]) => {
      if (a === b) return DIAS_SEMANA[a].curto;
      if (b === a + 1) return `${DIAS_SEMANA[a].curto}, ${DIAS_SEMANA[b].curto}`;
      return `${DIAS_SEMANA[a].curto} a ${DIAS_SEMANA[b].curto}`;
    })
    .join(', ');
}

/**
 * Converte o endereço digitado em latitude/longitude usando o Nominatim
 * (OpenStreetMap, gratuito). Se não encontrar, retorna null — o cadastro
 * segue mesmo assim, e a equipe pode geocodificar depois manualmente ou
 * rodando o script scripts/geocodificar-empresas.cjs.
 */
export async function geocodificarEndereco(endereco) {
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
export async function enviarFotos(arquivos) {
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

/**
 * Envia um e-mail pro admin (via EmailJS, direto do navegador, sem backend)
 * avisando que alguém preencheu o formulário "Cadastrar minha empresa".
 * O admin decide se/quando inclui a empresa em scripts/prestadores.xlsx.
 */
async function enviarEmailNotificacao({
  nome,
  telefone,
  whatsapp,
  instagram,
  endereco,
  labelsCategorias,
  especialidades,
  horarioTexto,
  fotosUrls,
  coordenadas,
}) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn(
      'EmailJS não configurado (faltam VITE_EMAILJS_SERVICE_ID / VITE_EMAILJS_TEMPLATE_ID / VITE_EMAILJS_PUBLIC_KEY no .env). ' +
        'O cadastro não foi notificado por e-mail.'
    );
    return;
  }

  const templateParams = {
    nome_empresa: nome,
    telefone: telefone || '-',
    whatsapp,
    instagram: instagram || '-',
    endereco,
    categorias: labelsCategorias.join(', '),
    especialidades: especialidades || '-',
    horario: horarioTexto || '-',
    fotos: fotosUrls.length ? fotosUrls.join('\n') : '-',
    coordenadas: coordenadas ? `${coordenadas.lat}, ${coordenadas.lng}` : 'não localizado automaticamente',
  };

  const resposta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: templateParams,
    }),
  });

  if (!resposta.ok) {
    // Não interrompe o fluxo do usuário por causa disso — ele já enviou as
    // fotos e preencheu tudo. Só loga pra investigar depois.
    console.error('Falha ao enviar e-mail de notificação de cadastro:', await resposta.text());
  }
}
