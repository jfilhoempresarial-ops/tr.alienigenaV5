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

// Mesmas categorias usadas no resto do site (home.js / admin.js), só pra
// mostrar o nome bonito em vez do código interno (ex: "mecanico" -> "Mecânico").
const LABEL_CATEGORIA = {
  mecanico: 'Mecânico',
  posto: 'Posto/Conveniência',
  borracharia: 'Borracharia',
  eletrica: 'Elétrica',
  guincho: 'Guincho',
  pontoapoio: 'P. Apoio',
  lavajato: 'Lava-Jato',
  autopecas: 'Auto Peças',
  tacografo: 'Tacógrafo',
};

export async function renderMapa(container) {
  container.innerHTML = `
    <section class="mapa-pagina">
      <div class="mapa-pagina__header">
        <h1>🗺️ Mapa de Prestadores</h1>
        <p>Toque num grupo de pinos pra ver quantos prestadores tem de cada categoria ali.</p>
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

  // zoomToBoundsOnClick: false — controlamos o clique manualmente (ver abaixo),
  // pra mostrar o resumo por categoria antes de dar zoom, em vez de já zoomar direto.
  // iconCreateFunction: customiza o "bolinha com número" pra incluir a logo TRA.
  const grupoPinos = L.markerClusterGroup({
    zoomToBoundsOnClick: false,
    iconCreateFunction: function (cluster) {
      const quantidade = cluster.getChildCount();
      return L.divIcon({
        html: `
          <div class="mapa-cluster-pino">
            <span class="mapa-cluster-pino__emoji">👽</span>
            <span class="mapa-cluster-pino__numero">${quantidade}</span>
          </div>
        `,
        className: 'mapa-cluster-icone',
        iconSize: L.point(54, 54),
      });
    },
  });

  try {
    const empresas = await buscarTodasEmpresas();
    let comCoordenadas = 0;

    empresas.forEach((empresa) => {
      if (typeof empresa.lat !== 'number' || typeof empresa.lng !== 'number') return;
      comCoordenadas++;

      const linkWhats = empresa.whatsapp
        ? gerarLinkWhatsapp(empresa.whatsapp, `Olá! Vi seu contato no mapa do TRA da Estrada.`)
        : null;

      // Guardamos as categorias direto nas opções do marcador, pra dar pra
      // somar por categoria quando ele estiver dentro de um cluster.
      const marker = L.marker([empresa.lat, empresa.lng], {
        categorias: empresa.categorias || [],
      }).bindPopup(`
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

  // Ao clicar num cluster: mostra o resumo por categoria + botão pra aproximar.
  grupoPinos.on('clusterclick', (evento) => {
    const cluster = evento.layer;
    const marcadores = cluster.getAllChildMarkers();

    const contagemPorCategoria = {};
    marcadores.forEach((marker) => {
      (marker.options.categorias || []).forEach((cat) => {
        contagemPorCategoria[cat] = (contagemPorCategoria[cat] || 0) + 1;
      });
    });

    const linhas = Object.entries(contagemPorCategoria)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, qtd]) => `<li>${LABEL_CATEGORIA[cat] || cat}<strong>${qtd}</strong></li>`)
      .join('');

    const html = `
      <div class="mapa-popup-cluster">
        <p class="mapa-popup-cluster__total">${marcadores.length} prestador${marcadores.length !== 1 ? 'es' : ''} nessa região</p>
        <ul class="mapa-popup-cluster__lista">${linhas || '<li>Sem categoria definida</li>'}</ul>
        <button class="mapa-popup-cluster__zoom" id="mapa-zoom-cluster-btn">🔍 Aproximar</button>
      </div>
    `;

    cluster.bindPopup(html, { maxWidth: 220 }).openPopup();

    // O botão só existe no DOM depois do popup abrir, então escutamos com um pequeno delay.
    setTimeout(() => {
      const botaoZoom = document.getElementById('mapa-zoom-cluster-btn');
      if (botaoZoom) {
        botaoZoom.addEventListener('click', () => {
          mapa.closePopup();
          cluster.zoomToBounds({ padding: [30, 30] });
        });
      }
    }, 0);
  });

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