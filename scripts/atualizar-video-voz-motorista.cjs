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
 *  2. Pega a lista dos vídeos mais recentes do canal. Tenta, nesta ordem:
 *       a) o "feed" público do canal;
 *       b) o feed da playlist de uploads do canal;
 *       c) a própria página de vídeos (e de transmissões) do canal.
 *     O feed do YouTube às vezes sai do ar (erro 404) — por isso os planos B e C.
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

/**
 * Plano C: lê a página "Vídeos" (ou "Ao vivo") do canal e tira a lista do
 * JSON que o YouTube coloca dentro dela (ytInitialData). A página já vem com
 * o mais novo primeiro.
 */
function lerPaginaDoCanal(html) {
  const achado = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!achado) return [];
  let dados;
  try {
    dados = JSON.parse(achado[1]);
  } catch {
    return [];
  }

  const textoDoTitulo = (t) =>
    !t ? '' : t.simpleText || t.content || (Array.isArray(t.runs) ? t.runs.map((r) => r.text).join('') : '');

  const videos = [];
  const vistos = new Set();
  (function andar(no) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach(andar);

    // Formato antigo: videoRenderer { videoId, title }
    if (typeof no.videoId === 'string' && no.title && !vistos.has(no.videoId)) {
      const titulo = textoDoTitulo(no.title);
      if (titulo) {
        vistos.add(no.videoId);
        videos.push({ videoId: no.videoId, titulo, publicado: '' });
      }
    }
    // Formato novo: lockupViewModel { contentId, metadata.lockupMetadataViewModel.title }
    if (typeof no.contentId === 'string' && no.metadata && !vistos.has(no.contentId)) {
      const titulo = textoDoTitulo(no.metadata.lockupMetadataViewModel?.title);
      if (titulo && /^[\w-]{11}$/.test(no.contentId)) {
        vistos.add(no.contentId);
        videos.push({ videoId: no.contentId, titulo, publicado: '' });
      }
    }
    Object.values(no).forEach(andar);
  })(dados);
  return videos;
}

async function buscarVideosDoCanal(canalId) {
  const tentativas = [
    ['feed do canal', `https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`, lerFeed],
    ['feed da playlist de uploads', `https://www.youtube.com/feeds/videos.xml?playlist_id=UU${canalId.slice(2)}`, lerFeed],
    ['página de vídeos do canal', `https://www.youtube.com/channel/${canalId}/videos`, lerPaginaDoCanal],
    ['página de transmissões do canal', `https://www.youtube.com/channel/${canalId}/streams`, lerPaginaDoCanal],
  ];

  const encontrados = [];
  for (const [nome, url, ler] of tentativas) {
    try {
      const videos = ler(await baixarTexto(url));
      console.log(`   • ${nome}: ${videos.length} vídeos`);
      encontrados.push(...videos);
      // Achou vídeo do programa? Não precisa tentar os outros caminhos.
      if (filtrarPrograma(videos).length) return videos;
    } catch (erro) {
      console.warn(`   • ${nome}: falhou (${erro.message})`);
    }
  }
  return encontrados;
}

/** Fica só com os vídeos do programa. Prefere "Programa Completo". */
function filtrarPrograma(videos) {
  const doPrograma = videos.filter((v) => normalizar(v.titulo).includes('voz do motorista'));
  const completos = doPrograma.filter((v) => normalizar(v.titulo).includes('programa completo'));
  return completos.length ? completos : doPrograma.filter((v) => normalizar(v.titulo).includes('programa'));
}

async function main() {
  initializeApp({ credential: cert(chaveServiceAccount()) });
  const db = getFirestore();
  const ref = db.collection(DOC_REF[0]).doc(DOC_REF[1]);
  const docSnap = await ref.get();

  const canalId = await descobrirCanal(docSnap);
  // Guarda o ID do canal logo de cara, para não precisar descobrir de novo
  await ref.set({ canalId }, { merge: true });

  console.log('🌐 Lendo os vídeos mais recentes do canal...');
  const todos = await buscarVideosDoCanal(canalId);
  console.log(`📦 ${todos.length} vídeos recentes encontrados.`);

  const programa = filtrarPrograma(todos).slice(0, QTD_VIDEOS);
  if (!programa.length) {
    // Deixa o workflow vermelho para você perceber, mas NÃO mexe no site
    throw new Error('Nenhum vídeo do programa encontrado. Nada foi alterado no site.');
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
