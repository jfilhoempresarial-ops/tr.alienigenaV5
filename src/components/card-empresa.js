import { formatarDistancia } from '../utils/formatters.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';
import { renderEstrelas, formatarNota } from './estrelas.js';

const NOTAS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Recebe um objeto empresa (já com distanciaKm calculada) e retorna o HTML do card. */
export function renderCardEmpresa(empresa) {
  const linkWhats = gerarLinkWhatsapp(
    empresa.whatsapp,
    `Olá! Vi seu contato no TRA da Estrada e preciso de ajuda.`
  );

  const totalAvaliacoes = empresa.totalAvaliacoes || 0;

  return `
    <div class="card-empresa">
      <div class="card-empresa__header">
        <h3>${empresa.nome}</h3>
        <span class="card-empresa__distancia">${formatarDistancia(empresa.distanciaKm)}</span>
      </div>
      <p class="card-empresa__endereco">${empresa.endereco ?? ''}</p>
      <div class="card-empresa__tags">
        ${empresa.disponivel24h ? '<span class="tag">24h</span>' : ''}
        ${empresa.atendeCarreta ? '<span class="tag">Atende carreta</span>' : ''}
      </div>

      <div class="card-empresa__avaliacao">
        <p class="card-empresa__nota">
          ${renderEstrelas(empresa.notaMedia)} ${formatarNota(empresa.notaMedia)}
          <span class="card-empresa__nota-total">(${totalAvaliacoes} avaliação${totalAvaliacoes !== 1 ? 'ões' : ''})</span>
        </p>
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

      <a href="${linkWhats}" target="_blank" rel="noopener" class="card-empresa__whatsapp">
        Chamar no WhatsApp
      </a>
    </div>
  `;
}
