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
const MENSAGEM_PADRAO_WHATSAPP = 'Olá! Vi seu anúncio no site da TRA da Estrada e queria mais informações.';

// Serviço de roteamento gratuito, sem chave de API (instância pública de
// demonstração do projeto OSRM). Sem SLA garantido — se o volume de uso
// crescer muito, vale considerar uma instância própria/paga no futuro.
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

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

// Ícone usado nos marcadores individuais (empresas que não formaram cluster).
// Mesmo tamanho e estrutura do ícone de cluster (alienígena + numerozinho),
// só que com "1" fixo, pra ficar visualmente idêntico aos clusters.
const iconeEmpresa = L.divIcon({
  html: `
    <div class="mapa-cluster-pino">
      <span class="mapa-cluster-pino__emoji">👽</span>
      <span class="mapa-cluster-pino__numero">1</span>
    </div>
  `,
  className: 'mapa-cluster-icone',
  iconSize: L.point(54, 54),
});

// Ícone vermelho pros Pontos de Parada e Descanso (PPD) oficiais do governo —
// pra diferenciar visualmente dos prestadores comuns (verde). Mesmo tamanho,
// cor e emoji diferentes.
const iconePpd = L.divIcon({
  html: `
    <div class="mapa-cluster-pino mapa-cluster-pino--ppd">
      <span class="mapa-cluster-pino__emoji">🛏️</span>
      <span class="mapa-cluster-pino__numero mapa-cluster-pino__numero--ppd">1</span>
    </div>
  `,
  className: 'mapa-cluster-icone',
  iconSize: L.point(54, 54),
});

/**
 * Busca a rota de carro entre dois pontos no OSRM, desenha ela no mapa
 * (substituindo a rota anterior, se houver) e enquadra a view nela.
 * Retorna a distância (km) e duração (min) formatadas.
 */
async function tracarRotaNoMapa(mapa, estadoRota, origem, destino) {
  const url = `${OSRM_URL}/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error('Falha ao buscar rota no OSRM.');

  const dados = await resposta.json();
  if (!dados.routes || dados.routes.length === 0) throw new Error('Nenhuma rota encontrada.');

  const rota = dados.routes[0];
  // O OSRM devolve [lng, lat]; o Leaflet espera [lat, lng].
  const coordenadas = rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]);

  if (estadoRota.linha) {
    mapa.removeLayer(estadoRota.linha);
  }
  estadoRota.linha = L.polyline(coordenadas, { color: '#1a7a3c', weight: 5, opacity: 0.8 }).addTo(mapa);
  mapa.fitBounds(estadoRota.linha.getBounds(), { padding: [40, 40] });

  return {
    distanciaKm: (rota.distance / 1000).toFixed(1),
    duracaoMin: Math.round(rota.duration / 60),
  };
}

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

  // Guarda a localização do usuário (preenchida mais abaixo) e a linha de
  // rota atualmente desenhada, pra poderem ser usadas pelo botão "Traçar
  // rota" de qualquer popup, sem precisar pedir localização de novo toda vez.
  let localizacaoUsuario = null;
  const estadoRota = { linha: null };

  // Empresa específica vinda da busca (ver /busca -> "📍 Ver localização"),
  // ex: /mapa?empresa=oficina-tal-sobral — se vier, focamos nela direto.
  const parametrosUrl = new URLSearchParams(window.location.search);
  const empresaIdAlvo = parametrosUrl.get('empresa');
  let marcadorAlvo = null;

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
        ? gerarLinkWhatsapp(empresa.whatsapp, MENSAGEM_PADRAO_WHATSAPP)
        : null;

      // ID usado no botão de rota (pra achar o elemento certo no DOM quando
      // o popup abrir) e pra identificar o marcador-alvo vindo da URL.
      const idSeguro = (empresa.id || '').replace(/[^a-zA-Z0-9_-]/g, '');

      // Guardamos as categorias direto nas opções do marcador, pra dar pra
      // somar por categoria quando ele estiver dentro de um cluster.
      const marker = L.marker([empresa.lat, empresa.lng], {
        categorias: empresa.categorias || [],
        icon: empresa.origem === 'ppd-gov-br' ? iconePpd : iconeEmpresa,
      }).bindPopup(`
        <div class="mapa-popup-empresa">
          <strong>${empresa.nome}</strong><br/>
          ${empresa.endereco ? `${empresa.endereco}<br/>` : ''}
          ${linkWhats ? `<a href="${linkWhats}" target="_blank" rel="noopener">💬 Chamar no WhatsApp</a><br/>` : ''}
          <button class="mapa-popup-rota-btn" id="mapa-rota-btn-${idSeguro}">🧭 Traçar rota até aqui</button>
          <div class="mapa-popup-rota-info" id="mapa-rota-info-${idSeguro}"></div>
        </div>
      `);

      // Liga o clique do botão de rota sempre que ESSE popup específico abrir
      // (o conteúdo só existe no DOM depois de aberto).
      marker.on('popupopen', () => {
        const botao = document.getElementById(`mapa-rota-btn-${idSeguro}`);
        const infoEl = document.getElementById(`mapa-rota-info-${idSeguro}`);
        if (!botao) return;

        botao.addEventListener('click', async () => {
          infoEl.textContent = '📡 Calculando rota...';
          try {
            if (!localizacaoUsuario) {
              localizacaoUsuario = await obterLocalizacaoAtual();
            }
            const resultado = await tracarRotaNoMapa(mapa, estadoRota, localizacaoUsuario, {
              lat: empresa.lat,
              lng: empresa.lng,
            });
            infoEl.textContent = `📍 ${resultado.distanciaKm} km • ⏱️ cerca de ${resultado.duracaoMin} min de carro`;
          } catch (erro) {
            infoEl.textContent = '❌ Não foi possível calcular a rota. Ative sua localização e tente de novo.';
            console.error(erro);
          }
        });
      });

      grupoPinos.addLayer(marker);

      if (empresaIdAlvo && empresa.id === empresaIdAlvo) {
        marcadorAlvo = marker;
      }
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

  // Se veio um ?empresa= específico na URL, foca nele: o markercluster
  // expande automaticamente o cluster necessário pra revelar o marcador e,
  // no callback, abrimos o popup dele já com o botão de rota disponível.
  if (marcadorAlvo) {
    grupoPinos.zoomToShowLayer(marcadorAlvo, () => {
      marcadorAlvo.openPopup();
    });
  }

  // Ponto azul: localização do usuário (bônus, não trava o mapa se falhar).
  // Se já estamos focando numa empresa específica (marcadorAlvo), não
  // sobrescrevemos a view — só adicionamos o ponto azul, se disponível.
  try {
    localizacaoUsuario = await obterLocalizacaoAtual();
    const iconeUsuario = L.divIcon({
      className: 'mapa-pino-usuario',
      iconSize: [18, 18],
    });
    L.marker([localizacaoUsuario.lat, localizacaoUsuario.lng], { icon: iconeUsuario, zIndexOffset: 1000 })
      .addTo(mapa)
      .bindPopup('Você está aqui');

    if (!marcadorAlvo) {
      mapa.setView([localizacaoUsuario.lat, localizacaoUsuario.lng], 12);
    }
  } catch (erro) {
    console.warn('Localização do usuário indisponível para o mapa.', erro);
  }
}
