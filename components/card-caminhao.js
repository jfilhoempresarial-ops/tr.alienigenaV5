import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';

export function renderCardCaminhao(caminhao) {
  const linkWhats = gerarLinkWhatsapp(
    caminhao.whatsapp,
    `Olá! Vi o anúncio do seu caminhão no TRA da Estrada e tenho interesse.`
  );

  return `
    <div class="card-caminhao">
      ${caminhao.fotoUrl ? `<img src="${caminhao.fotoUrl}" alt="${caminhao.modelo}" class="card-caminhao__foto" loading="lazy" />` : ''}
      <div class="card-caminhao__conteudo">
        <h3>${caminhao.modelo} — ${caminhao.ano}</h3>
        <p class="card-caminhao__preco">R$ ${caminhao.preco}</p>
        <p class="card-caminhao__local">${caminhao.cidade ?? ''} - ${caminhao.uf ?? ''}</p>
        <a href="${linkWhats}" target="_blank" rel="noopener" class="card-empresa__whatsapp">
          Chamar no WhatsApp
        </a>
      </div>
    </div>
  `;
}
