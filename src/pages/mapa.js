import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Corrige um problema conhecido do Leaflet com bundlers (Vite): sem isso,
// os ícones padrão dos pinos ficam quebrados (imagem não aparece).
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

import { buscarTodasEmpresas } from '../services/empresas.service.js';
import { obterLocalizacaoAtual } from '../services/geo.service.js';
import { gerarLinkWhatsapp } from '../services/whatsapp.service.js';

const CENTRO_BRASIL = [-14.235, -51.9253];
const ZOOM_INICIAL = 4;

export async function renderMapa(container) {
  container.innerHTML = `
    <section class="mapa-pagina">
      <div class="mapa-pagina__header">
        <h1>🗺️ Mapa de Prestadores</h1>
        <p>Veja no mapa onde tem ajuda cadastrada. Dê zoom pra ver os pinos se separarem.</p>
      </div>
      <div id="mapa-leaflet" class="mapa-leaflet"></div>
      <p id="mapa-status" class="mapa-pagina__status"></p>
    </section>
  `;

  const status = container.querySelector('#mapa-status');
  const mapa = L.map('mapa-leaflet').setView(CENTRO_BRASIL, ZOOM_INICIAL);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapa);

  const grupoPinos = L.markerClusterGroup();

  try {
    const empresas = await buscarTodasEmpresas();
    let comCoordenadas = 0;

    empresas.forEach((empresa) => {
      if (typeof empresa.lat !== 'number' || typeof empresa.lng !== 'number') return;
      comCoordenadas++;

      const linkWhats = empresa.whatsapp
        ? gerarLinkWhatsapp(empresa.whatsapp, `Olá! Vi seu contato no mapa do TRA da Estrada.`)
        : null;

      const marker = L.marker([empresa.lat, empresa.lng]).bindPopup(`
        <strong>${empresa.nome}</strong><br/>
        ${empresa.endereco ? `${empresa.endereco}<br/>` : ''}
        ${linkWhats ? `<a href="${linkWhats}" target="_blank" rel="noopener">💬 Chamar no WhatsApp</a>` : ''}
      `);
      grupoPinos.addLayer(marker);
    });

    mapa.addLayer(grupoPinos);

    if (comCoordenadas === 0) {
      status.textContent = 'Nenhum prestador com localização cadastrada ainda.';
    }
  } catch (erro) {
    status.textContent = 'Não foi possível carregar os prestadores no mapa agora.';
    console.error(erro);
  }

  // Ponto azul: localização do usuário (bônus, não trava o mapa se falhar)
  try {
    const localizacao = await obterLocalizacaoAtual();
    const iconeUsuario = L.divIcon({
      className: 'mapa-pino-usuario',
      iconSize: [18, 18],
    });
    L.marker([localizacao.lat, localizacao.lng], { icon: iconeUsuario, zIndexOffset: 1000 })
      .addTo(mapa)
      .bindPopup('Você está aqui');
    mapa.setView([localizacao.lat, localizacao.lng], 12);
  } catch (erro) {
    console.warn('Localização do usuário indisponível para o mapa.', erro);
  }
}