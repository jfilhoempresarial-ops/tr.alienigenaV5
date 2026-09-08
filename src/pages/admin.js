import { fazerLogin, fazerLogout, observarAutenticacao } from '../services/auth.service.js';
import { criarEvento } from '../services/eventos.service.js';
import {
  buscarEmpresasPendentes,
  aprovarEmpresa,
  recusarEmpresa,
  buscarTodasEmpresas,
  criarEmpresaAdmin,
} from '../services/empresas.service.js';
import { otimizarFotoCloudinary } from '../utils/cloudinary.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { CATEGORIAS_CADASTRO, geocodificarEndereco, enviarFotos } from './cadastro-empresa.js';

const MAX_FOTOS_EDICAO = 5;

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

      <h2 class="admin-painel__titulo-cobertura">✏️ Editar prestador</h2>
      <p class="admin-painel__subtitulo-cobertura">
        Busca um prestador já cadastrado (venha da planilha ou do site) e edita os dados dele na hora —
        útil pra quando você está de frente com o prestador e ele pede pra ajustar algo, ou pra adicionar foto
        e localização por GPS. <strong>Isso cria um cadastro novo</strong>; se o prestador tiver vindo da
        planilha de prestadores, lembre de apagar a linha antiga de lá depois, senão ele fica duplicado até a
        próxima sincronização remover o antigo sozinha.
      </p>
      <input
        type="text"
        id="editar-prestador-busca"
        placeholder="Digite o nome do prestador..."
        class="cadastro__input"
        style="width:100%;padding:10px;border-radius:8px;border:1px solid #ccc;margin-bottom:10px;"
      />
      <div id="editar-prestador-resultados"></div>
      <div id="editar-prestador-form-wrap"></div>
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
  configurarEdicaoPrestadores(container);
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

function normalizarTexto(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/** Configura a busca + edição de prestadores. Carrega todas as empresas uma
 * vez (a mesma lista usada na busca geral do site) e filtra na hora, sem
 * precisar ficar consultando o Firestore a cada letra digitada. */
async function configurarEdicaoPrestadores(container) {
  const inputBusca = container.querySelector('#editar-prestador-busca');
  const resultadosDiv = container.querySelector('#editar-prestador-resultados');
  const formWrapDiv = container.querySelector('#editar-prestador-form-wrap');

  let todasEmpresas = [];
  try {
    todasEmpresas = await buscarTodasEmpresas();
  } catch (erro) {
    resultadosDiv.innerHTML = `<p class="erro">Não foi possível carregar a lista de prestadores agora.</p>`;
    console.error(erro);
    return;
  }

  inputBusca.addEventListener('input', () => {
    const termo = normalizarTexto(inputBusca.value.trim());
    formWrapDiv.innerHTML = ''; // fecha o formulário aberto se a pessoa voltar a digitar

    if (termo.length < 2) {
      resultadosDiv.innerHTML = '';
      return;
    }

    const encontradas = todasEmpresas
      .filter((e) => normalizarTexto(e.nome).includes(termo))
      .slice(0, 15); // não precisa listar centenas de resultados de uma vez

    if (encontradas.length === 0) {
      resultadosDiv.innerHTML = `<p class="vazio">Nenhum prestador encontrado com esse nome.</p>`;
      return;
    }

    resultadosDiv.innerHTML = encontradas
      .map(
        (e) => `
        <button
          type="button"
          class="admin-pendente-card__acoes btn-secundario"
          data-editar-empresa="${e.id}"
          style="display:block;width:100%;text-align:left;margin-bottom:6px;padding:10px;border-radius:8px;"
        >
          ${e.nome} ${e.cidade ? `— 📍 ${e.cidade}${e.estado ? '/' + e.estado : ''}` : ''}
        </button>
      `
      )
      .join('');

    resultadosDiv.querySelectorAll('[data-editar-empresa]').forEach((botao) => {
      botao.addEventListener('click', () => {
        const empresa = todasEmpresas.find((e) => e.id === botao.dataset.editarEmpresa);
        if (empresa) renderFormularioEdicao(formWrapDiv, empresa);
        formWrapDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  });
}

/** Renderiza o formulário de edição já preenchido com os dados atuais da
 * empresa selecionada — mesmos campos do cadastro público (cadastro-empresa.js),
 * mais Cidade/Estado (que o formulário público não tem, mas os prestadores
 * da planilha já usam pra agrupar por estado nas páginas de categoria). */
function renderFormularioEdicao(container, empresa) {
  const categoriasAtuais = new Set(empresa.categorias || []);
  const fotosAtuais = empresa.fotos || [];

  container.innerHTML = `
    <div class="cadastro" style="border:2px solid #16a34a;border-radius:10px;padding:16px;margin-top:12px;">
      <h3>Editando: ${empresa.nome}</h3>
      <form id="form-editar-prestador">
        <label>Nome da empresa <input name="nome" required value="${empresa.nome || ''}" /></label>
        <label>Telefone (fixo, se tiver) <input name="telefone" value="${empresa.telefone || ''}" /></label>
        <label>WhatsApp <input name="whatsapp" required value="${empresa.whatsapp || ''}" /></label>
        <label>Instagram (opcional) <input name="instagram" value="${empresa.instagram || ''}" placeholder="@suaempresa" /></label>

        <label>Endereço completo <input name="endereco" id="editar-endereco" required value="${empresa.endereco || ''}" /></label>
        <label>Cidade <input name="cidade" value="${empresa.cidade || ''}" /></label>
        <label>Estado (sigla, ex: CE) <input name="estado" maxlength="2" value="${empresa.estado || ''}" /></label>

        <button type="button" id="btn-usar-localizacao-edicao" class="cadastro__botao-localizacao">
          📍 Usar minha localização atual
        </button>
        <p class="cadastro__ajuda-endereco">
          Útil quando você está na frente do prestador — captura a localização certa na hora pelo GPS do
          celular. Se não usar, mantemos a coordenada que já existia (${
            typeof empresa.lat === 'number' ? 'já tinha uma salva' : 'nenhuma salva ainda'
          }).
        </p>
        <p id="editar-localizacao-status" class="cadastro__localizacao-status"></p>

        <p class="cadastro__label-extra">Categorias:</p>
        <div class="cadastro__categorias-extras">
          ${CATEGORIAS_CADASTRO.map(
            (c) => `
            <label class="cadastro__categoria-extra-item">
              <input type="checkbox" name="categorias" value="${c.id}" ${categoriasAtuais.has(c.id) ? 'checked' : ''} />
              ${c.label}
            </label>
          `
          ).join('')}
        </div>

        <label>
          Especialidades (opcional)
          <textarea name="especialidades" rows="3">${empresa.especialidades || ''}</textarea>
        </label>

        ${
          fotosAtuais.length > 0
            ? `
          <p class="cadastro__label-extra">Fotos atuais (desmarque pra remover):</p>
          <div class="admin-pendente-card__fotos" id="fotos-atuais-lista">
            ${fotosAtuais
              .map(
                (url, i) => `
              <label style="display:inline-block;text-align:center;margin-right:8px;">
                <img src="${otimizarFotoCloudinary(url, { largura: 300, altura: 220 })}" alt="" style="width:120px;height:90px;object-fit:cover;border-radius:8px;display:block;margin-bottom:4px;" />
                <input type="checkbox" name="manterFoto" value="${url}" checked /> manter
              </label>
            `
              )
              .join('')}
          </div>
        `
            : ''
        }

        <label>
          Adicionar fotos novas (até ${MAX_FOTOS_EDICAO} no total, contando as mantidas acima)
          <input type="file" name="fotosNovas" id="editar-fotos" accept="image/*" multiple />
        </label>

        <button type="submit">💾 Salvar como cadastro atualizado</button>
        <button type="button" id="btn-cancelar-edicao" class="btn-secundario">Cancelar</button>
      </form>
      <p id="editar-status"></p>
    </div>
  `;

  let coordenadasCapturadas = null;

  container.querySelector('#btn-cancelar-edicao').addEventListener('click', () => {
    container.innerHTML = '';
  });

  container.querySelector('#btn-usar-localizacao-edicao').addEventListener('click', async () => {
    const status = container.querySelector('#editar-localizacao-status');
    status.textContent = '📡 Buscando sua localização...';
    try {
      coordenadasCapturadas = await obterLocalizacaoAtual();
      status.textContent = '✅ Localização atual capturada com sucesso!';
    } catch (erro) {
      status.textContent = '❌ Não foi possível pegar sua localização. Verifique a permissão do navegador.';
      console.error(erro);
    }
  });

  container.querySelector('#form-editar-prestador').addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = container.querySelector('#editar-status');
    status.textContent = 'Salvando...';

    try {
      const formData = new FormData(event.target);
      const categorias = formData.getAll('categorias');
      if (categorias.length === 0) {
        status.textContent = 'Escolhe pelo menos uma categoria.';
        return;
      }

      const fotosParaManter = formData.getAll('manterFoto');
      const inputFotosNovas = container.querySelector('#editar-fotos');
      const arquivosNovos = Array.from(inputFotosNovas.files).slice(
        0,
        Math.max(0, MAX_FOTOS_EDICAO - fotosParaManter.length)
      );

      status.textContent = 'Enviando fotos novas...';
      const fotosNovasUrls = arquivosNovos.length ? await enviarFotos(arquivosNovos) : [];
      const fotos = [...fotosParaManter, ...fotosNovasUrls];

      const endereco = formData.get('endereco');
      let lat = typeof empresa.lat === 'number' ? empresa.lat : null;
      let lng = typeof empresa.lng === 'number' ? empresa.lng : null;

      if (coordenadasCapturadas) {
        lat = coordenadasCapturadas.lat;
        lng = coordenadasCapturadas.lng;
      } else if (endereco !== empresa.endereco) {
        // Endereço mudou e ninguém usou o GPS — geocodifica de novo pra não
        // deixar uma coordenada velha apontando pro endereço antigo.
        status.textContent = 'Localizando novo endereço...';
        const coordenadas = await geocodificarEndereco(endereco);
        if (coordenadas) {
          lat = coordenadas.lat;
          lng = coordenadas.lng;
        }
      }

      status.textContent = 'Salvando cadastro atualizado...';
      await criarEmpresaAdmin({
        nome: formData.get('nome'),
        telefone: formData.get('telefone') || '',
        whatsapp: formData.get('whatsapp'),
        instagram: (formData.get('instagram') || '').replace(/^@/, ''),
        endereco,
        cidade: formData.get('cidade') || '',
        estado: (formData.get('estado') || '').toUpperCase(),
        categorias,
        especialidades: formData.get('especialidades') || '',
        fotos,
        lat,
        lng,
      });

      status.textContent =
        '✅ Cadastro atualizado criado com sucesso! Não esquece de apagar a linha antiga desse prestador na planilha do Google.';
    } catch (erro) {
      status.textContent = 'Erro ao salvar. Tente novamente.';
      console.error(erro);
    }
  });
}
