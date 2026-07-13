import { formatarDistancia } from '../utils/formatters.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';

/** Recebe um objeto empresa (já com distanciaKm calculada) e retorna o HTML do card. */
export function renderCardEmpresa(empresa) {
  const linkWhats = gerarLinkWhatsapp(
    empresa.whatsapp,
    `Olá! Vi seu contato no TRA da Estrada e preciso de ajuda.`
  );

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
      <a href="${linkWhats}" target="_blank" rel="noopener" class="card-empresa__whatsapp">
        Chamar no WhatsApp
      </a>
    </div>
  `;
}
