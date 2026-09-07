import { formatarDistancia } from '../utils/formatters.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';
import { renderEstrelas, formatarNota } from './estrelas.js';
import { otimizarFotoCloudinary } from '../utils/cloudinary.js';

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Gera o link do Google Maps: usa lat/lng se existir, senão busca pelo endereço digitado. */
function gerarLinkMapa(empresa) {
  if (typeof empresa.lat === 'number' && typeof empresa.lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${empresa.lat},${empresa.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(empresa.endereco || empresa.nome)}`;
}

/** Recebe um objeto empresa (já com distanciaKm calculada) e retorna o HTML do card. */
export function renderCardEmpresa(empresa) {
  const linkWhats = empresa.whatsapp
    ? gerarLinkWhatsapp(empresa.whatsapp, 'Olá! Vi seu anúncio no site da TRA da Estrada e queria mais informações.')
    : null;
  const linkMapa = gerarLinkMapa(empresa);

  const totalAvaliacoes = empresa.totalAvaliacoes || 0;
  const distancia = formatarDistancia(empresa.distanciaKm);
  const foto = empresa.fotos && empresa.fotos.length > 0 ? empresa.fotos[0] : null;

  return `
    <div class="card-empresa">
      ${
        foto
          ? `<img
              src="${otimizarFotoCloudinary(foto, { largura: 600, altura: 300 })}"
              alt="Foto de ${empresa.nome}"
              loading="lazy"
              style="width:100%;height:160px;object-fit:cover;border-radius:10px;margin-bottom:10px;display:block;"
            />`
          : ''
      }
      <div class="card-empresa__topo">
        <h3 class="card-empresa__nome">${empresa.nome}</h3>
        ${distancia ? `<span class="card-empresa__distancia">${distancia}</span>` : ''}
      </div>

      ${empresa.endereco ? `<p class="card-empresa__endereco">${empresa.endereco}</p>` : ''}

      ${empresa.descricao ? `<p class="card-empresa__descricao">${empresa.descricao}</p>` : ''}

      <div class="card-empresa__linha">
        ${empresa.disponivel24h ? '<span class="tag tag--pequena">24h</span>' : ''}
        ${empresa.atendeCarreta ? '<span class="tag tag--pequena">Carreta</span>' : ''}
        <span class="card-empresa__nota">
          ${renderEstrelas(empresa.notaMedia)} ${formatarNota(empresa.notaMedia)}
          <span class="card-empresa__nota-total">(${totalAvaliacoes})</span>
        </span>
      </div>

      <div class="card-empresa__acoes">
        ${
          empresa.whatsapp
            ? `<a href="${linkWhats}" target="_blank" rel="noopener" class="card-empresa__botao card-empresa__botao--whatsapp">
          💬 WhatsApp
        </a>`
            : ''
        }
        <a href="${linkMapa}" target="_blank" rel="noopener" class="card-empresa__botao card-empresa__botao--mapa">
          📍 Como chegar
        </a>
        <button
          type="button"
          class="card-empresa__botao"
          data-copiar-link="${empresa.id}"
          style="cursor:pointer;border:1px solid #ccc;background:#f5f5f5;color:#222;"
        >
          🔗 Copiar link
        </button>
      </div>

      <button class="card-empresa__avaliar-btn" data-abrir-avaliacao="${empresa.id}">
        Avaliar esta empresa
      </button>
      ${renderPainelAvaliar(empresa.id)}
    </div>
  `;
}

/** Painel de avaliação (login Google + nota 1-10 + comentário opcional) — reaproveitado nos dois tipos de card. */
function renderPainelAvaliar(empresaId) {
  return `
      <div class="card-empresa__avaliar-notas" id="avaliar-notas-${empresaId}" hidden>
        <div id="avaliar-login-${empresaId}">
          <p class="card-empresa__avaliar-instrucao">Pra avaliar, entra com sua conta Google (rapidinho, sem senha):</p>
          <button
            type="button"
            data-login-google="${empresaId}"
            style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;background:#fff;color:#3c4043;border:1px solid #dadce0;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer;"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" width="18" height="18" />
            Entrar com Google
          </button>
        </div>
        <div id="avaliar-form-${empresaId}" hidden>
          <p class="card-empresa__avaliar-instrucao">De 1 (ruim) a 10 (ótimo), qual sua nota?</p>
          <div class="card-empresa__avaliar-botoes" data-notas-empresa="${empresaId}">
            ${NOTAS.map((n) => `<button type="button" class="nota-btn" data-nota-valor="${n}">${n}</button>`).join('')}
          </div>
          <textarea
            id="avaliar-comentario-${empresaId}"
            rows="2"
            placeholder="Quer contar como foi? (opcional)"
            style="width:100%;margin-top:8px;padding:8px;border-radius:8px;border:1px solid #ccc;font-family:inherit;"
          ></textarea>
          <button
            type="button"
            data-enviar-avaliacao="${empresaId}"
            class="card-empresa__avaliar-btn"
            style="margin-top:8px;"
            disabled
          >
            Enviar avaliação
          </button>
        </div>
      </div>
  `;
}

/**
 * Card simplificado pra ranking de "melhores empresas pra trabalhar":
 * só nome, posição no ranking, nota e avaliações — sem WhatsApp, sem mapa,
 * sem foto. O motorista avalia a empresa onde trabalha/trabalhou.
 */
export function renderCardRanking(empresa, posicao) {
  const totalAvaliacoes = empresa.totalAvaliacoes || 0;
  const localizacao = [empresa.cidade, empresa.estado].filter(Boolean).join('/');

  return `
    <div class="card-empresa">
      <div class="card-empresa__topo">
        <h3 class="card-empresa__nome">#${posicao} ${empresa.nome}</h3>
      </div>
      ${localizacao ? `<p class="card-empresa__endereco">📍 ${localizacao}</p>` : ''}
      <div class="card-empresa__linha">
        <span class="card-empresa__nota">
          ${renderEstrelas(empresa.notaMedia)} ${formatarNota(empresa.notaMedia)}
          <span class="card-empresa__nota-total">(${totalAvaliacoes})</span>
        </span>
      </div>
      <button class="card-empresa__avaliar-btn" data-abrir-avaliacao="${empresa.id}">
        Avaliar esta empresa
      </button>
      ${renderPainelAvaliar(empresa.id)}
    </div>
  `;
}

/** Card compacto pra listar uma avaliação recente (nota + comentário + quem avaliou). */
export function renderCardAvaliacao(avaliacao) {
  return `
    <div class="mini-card">
      <p class="mini-card__titulo">${avaliacao.empresaNome || 'Empresa'}</p>
      <p class="mini-card__avaliacao">
        ${renderEstrelas(avaliacao.nota)} ${formatarNota(avaliacao.nota)}
      </p>
      ${
        avaliacao.comentario
          ? `<p style="font-style:italic;color:#555;margin:6px 0;font-size:0.9em;">“${avaliacao.comentario}”</p>`
          : ''
      }
      <p class="mini-card__sub">— ${avaliacao.nomeAvaliador || 'Motorista'}</p>
    </div>
  `;
}
