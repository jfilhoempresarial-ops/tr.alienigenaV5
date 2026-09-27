/**
 * Busca no YouTube o vídeo mais recente do Programa "A Voz do Motorista"
 * (canal TR Alienígena) e salva no Firestore, em configuracoes/voz-motorista.
 * A Home lê esse documento e mostra o vídeo mais novo em destaque.
 *
 * Roda pelo GitHub Actions: sábado 22h e domingo 12h (horário de Brasília).
 *
 * COMO FUNCIONA (sem chave de API do YouTube):
 *  1. Descobre o ID do canal a partir de um vídeo que já sabemos que é do
 *     canal (VIDEO_REFERENCIA). O ID fica guardado no Firestore depois da
 *     primeira vez, então essa etapa só roda uma vez.
 *  2. Lê o "feed" público do canal (lista dos 15 vídeos mais recentes).
 *  3. Fica só com os vídeos do programa (título com "Voz do Motorista"),
 *     dando preferência aos "Programa Completo" — assim Shorts e cortes não
 *     tomam o lugar do programa.
 *
 * SEGURANÇA: se não achar nenhum vídeo do programa, NÃO apaga nada — a Home
 * continua mostrando o último que estava salvo.
 *
 * COMO TESTAR LOCALMENTE:
 *   node scripts/atualizar-video-voz-motorista.cjs
 * (usa o scripts/serviceAccountKey.json que você já tem)
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Um vídeo qualquer do canal TR Alienígena (usado só para descobrir o canal).
const VIDEO_REFERENCIA = 'SRRWlFGGstE';

// Se um dia você souber o ID do canal (começa com "UC"), pode colocar aqui
// e o script pula a etapa de descobrir. Deixe vazio para descobrir sozinho.
const CANAL_ID_FIXO = '';

const QTD_VIDEOS = 4; // 1 em destaque + até 3 miniaturas na Home
const DOC_REF = ['configuracoes', 'voz-motorista'];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  // Evita a página de "aceitar cookies" do YouTube
  Cookie: 'CONSENT=YES+cb; SOCS=CAI',
};

function chaveServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(path.join(__dirname, 'serviceAccountKey.json'));
}

function normalizar(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodificarXml(txt) {
  return String(txt || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

async function baixarTexto(url) {
  const resposta = await fetch(url, { headers: HEADERS });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status} ao acessar ${url}`);
  return resposta.text();
}

async function descobrirCanal(docSnap) {
  if (CANAL_ID_FIXO) return CANAL_ID_FIXO;
  const salvo = docSnap.exists ? docSnap.data().canalId : '';
  if (salvo) return salvo;

  console.log('🔎 Descobrindo o ID do canal pelo vídeo de referência...');
  const html = await baixarTexto(`https://www.youtube.com/watch?v=${VIDEO_REFERENCIA}`);
  const achado =
    html.match(/"channelId":"(UC[\w-]{22})"/) ||
    html.match(/"externalChannelId":"(UC[\w-]{22})"/) ||
    html.match(/youtube\.com\/channel\/(UC[\w-]{22})/);
  if (!achado) throw new Error('Não consegui descobrir o ID do canal pelo vídeo de referência.');
  console.log(`📺 Canal encontrado: ${achado[1]}`);
  return achado[1];
}

/** Lê o feed do canal e devolve [{ videoId, titulo, publicado }], mais novo primeiro. */
function lerFeed(xml) {
  const videos = [];
  for (const bloco of xml.split('<entry>').slice(1)) {
    const videoId = (bloco.match(/<yt:videoId>([^<]+)<\/yt:videoId>/) || [])[1];
    const titulo = decodificarXml((bloco.match(/<title>([^<]*)<\/title>/) || [])[1]);
    const publicado = (bloco.match(/<published>([^<]+)<\/published>/) || [])[1];
    if (videoId && titulo) videos.push({ videoId, titulo: titulo.trim(), publicado: publicado || '' });
  }
  return videos.sort((a, b) => String(b.publicado).localeCompare(String(a.publicado)));
}

/** Lê o ytInitialData da página do canal e devolve [{ videoId, titulo }], na ordem da página. */
function lerPaginaDoCanal(html) {
  const marcadores = ['var ytInitialData =', 'window["ytInitialData"] =', 'ytInitialData ='];
  let inicioJson = -1;

  for (const marcador of marcadores) {
    const pos = html.indexOf(marcador);
    if (pos === -1) continue;
    inicioJson = html.indexOf('{', pos + marcador.length);
    if (inicioJson !== -1) break;
  }

  if (inicioJson === -1) throw new Error('ytInitialData não encontrado na página do canal.');

  let nivel = 0;
  let emString = false;
  let escapado = false;
  let fimJson = -1;

  for (let i = inicioJson; i < html.length; i += 1) {
    const char = html[i];

    if (emString) {
      if (escapado) {
        escapado = false;
      } else if (char === '\\') {
        escapado = true;
      } else if (char === '"') {
        emString = false;
      }
      continue;
    }

    if (char === '"') {
      emString = true;
    } else if (char === '{') {
      nivel += 1;
    } else if (char === '}') {
      nivel -= 1;
      if (nivel === 0) {
        fimJson = i + 1;
        break;
      }
    }
  }

  if (fimJson === -1) throw new Error('ytInitialData incompleto na página do canal.');

  const dados = JSON.parse(html.slice(inicioJson, fimJson));
  const videos = [];
  const vistos = new Set();

  function adicionar(videoId, titulo) {
    if (!videoId || !titulo || vistos.has(videoId)) return;
    vistos.add(videoId);
    videos.push({ videoId, titulo: String(titulo).trim(), publicado: '' });
  }

  function percorrer(valor) {
    if (!valor || typeof valor !== 'object') return;

    if (valor.videoRenderer) {
      const video = valor.videoRenderer;
      const tituloRuns = Array.isArray(video.title?.runs)
        ? video.title.runs.map((item) => item.text || '').join('')
        : '';
      adicionar(video.videoId, tituloRuns || video.title?.simpleText || '');
    }

    if (valor.lockupViewModel) {
      const video = valor.lockupViewModel;
      const videoId = /^[\w-]{11}$/.test(video.contentId || '') ? video.contentId : '';
      const titulo = video.metadata?.lockupMetadataViewModel?.title?.content || '';
      adicionar(videoId, titulo);
    }

    if (Array.isArray(valor)) {
      for (const item of valor) percorrer(item);
      return;
    }

    for (const item of Object.values(valor)) percorrer(item);
  }

  percorrer(dados);
  return videos;
}

/** Fica só com os vídeos do programa. Prefere "Programa Completo". */
function filtrarPrograma(videos) {
  const doPrograma = videos.filter((v) => normalizar(v.titulo).includes('voz do motorista'));
  const completos = doPrograma.filter((v) => normalizar(v.titulo).includes('programa completo'));
  return completos.length ? completos : doPrograma.filter((v) => normalizar(v.titulo).includes('programa'));
}

async function buscarVideosDoCanal(canalId) {
  const playlistUploads = `UU${canalId.replace(/^UC/, '')}`;
  const caminhos = [
    {
      nome: 'feed do canal',
      buscar: async () =>
        lerFeed(await baixarTexto(`https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`)),
    },
    {
      nome: 'feed da playlist de uploads',
      buscar: async () =>
        lerFeed(await baixarTexto(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistUploads}`)),
    },
    {
      nome: 'página de vídeos',
      buscar: async () =>
        lerPaginaDoCanal(await baixarTexto(`https://www.youtube.com/channel/${canalId}/videos`)),
    },
    {
      nome: 'página de transmissões',
      buscar: async () =>
        lerPaginaDoCanal(await baixarTexto(`https://www.youtube.com/channel/${canalId}/streams`)),
    },
  ];

  for (const caminho of caminhos) {
    try {
      const videos = await caminho.buscar();
      const programa = filtrarPrograma(videos);
      console.log(`📦 ${caminho.nome}: ${videos.length} vídeos encontrados; ${programa.length} do programa.`);
      if (programa.length) return videos;
    } catch (erro) {
      console.warn(`⚠️  ${caminho.nome} falhou: ${erro.message}`);
    }
  }

  throw new Error('Nenhum caminho encontrou vídeo do programa A Voz do Motorista.');
}

async function main() {
  initializeApp({ credential: cert(chaveServiceAccount()) });
  const db = getFirestore();
  const ref = db.collection(DOC_REF[0]).doc(DOC_REF[1]);
  const docSnap = await ref.get();

  const canalId = await descobrirCanal(docSnap);
  await ref.set({ canalId }, { merge: true });

  console.log('🌐 Lendo os vídeos mais recentes do canal...');
  const todos = await buscarVideosDoCanal(canalId);
  const programa = filtrarPrograma(todos).slice(0, QTD_VIDEOS);
  if (!programa.length) {
    throw new Error('Nenhum vídeo do programa encontrado. A lista salva foi mantida.');
  }

  const anterior = docSnap.exists ? (docSnap.data().videos || [])[0]?.videoId : '';
  await ref.set({
    canalId,
    videos: programa,
    atualizado: new Date().toISOString(),
  });

  const novo = programa[0];
  console.log(
    novo.videoId === anterior
      ? `✅ Sem vídeo novo. Continua em destaque: "${novo.titulo}"`
      : `✅ Vídeo novo em destaque: "${novo.titulo}" (${novo.videoId})`
  );
}

main().catch((erro) => {
  console.error('❌ Erro:', erro.message);
  process.exit(1);
});
