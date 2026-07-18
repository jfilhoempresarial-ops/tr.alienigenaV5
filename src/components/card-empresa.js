import { formatarDistancia } from '../utils/formatters.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';
import { renderEstrelas, formatarNota } from './estrelas.js';

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
  const linkWhats = gerarLinkWhatsapp(
    empresa.whatsapp,
    `Olá! Vi seu contato no TRA da Estrada e preciso de ajuda.`
  );
  const linkMapa = gerarLinkMapa(empresa);

  const totalAvaliacoes = empresa.totalAvaliacoes || 0;
  const distancia = formatarDistancia(empresa.distanciaKm);

  return `
    <div class="card-empresa">
      <div class="card-empresa__topo">
        <h3 class="card-empresa__nome">${empresa.nome}</h3>
        ${distancia ? `<span class="card-empresa__distancia">${distancia}</span>` : ''}
      </div>

      ${empresa.endereco ? `<p class="card-empresa__endereco">${empresa.endereco}</p>` : ''}

      <div class="card-empresa__linha">
        ${empresa.disponivel24h ? '<span class="tag tag--pequena">24h</span>' : ''}
        ${empresa.atendeCarreta ? '<span class="tag tag--pequena">Carreta</span>' : ''}
        <span class="card-empresa__nota">
          ${renderEstrelas(empresa.notaMedia)} ${formatarNota(empresa.notaMedia)}
          <span class="card-empresa__nota-total">(${totalAvaliacoes})</span>
        </span>
      </div>

      <div class="card-empresa__acoes">
        <a href="${linkWhats}" target="_blank" rel="noopener" class="card-empresa__botao card-empresa__botao--whatsapp">
          💬 WhatsApp
        </a>
        <a href="${linkMapa}" target="_blank" rel="noopener" class="card-empresa__botao card-empresa__botao--mapa">
          📍 Como chegar
        </a>
      </div>

      <button class="card-empresa__avaliar-btn" data-abrir-avaliacao="${empresa.id}">
        Avaliar esta empresa
      </button>
      <div class="card-empresa__avaliar-notas" id="avaliar-notas-${empresa.id}" hidden>
        <p class="card-empresa__avaliar-instrucao">De 1 (ruim) a 10 (ótimo), qual sua nota?</p>
        <div class="card-empresa__avaliar-botoes">
          ${NOTAS.map((n) => `<button class="nota-btn" data-empresa-avaliar="${empresa.id}" data-nota="${n}">${n}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
}