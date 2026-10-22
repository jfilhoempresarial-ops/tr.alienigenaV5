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
 *     sem Shorts e cortes, e coloca em destaque o programa com a data MAIS
 *     RECENTE escrita na DESCRIÇÃO do vídeo (ex.: "18 de outubro de 2026").
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
    const link = (bloco.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || '';
    const descricao = decodificarXml((bloco.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1]);
    if (videoId && titulo) {
      videos.push({
        videoId,
        titulo: titulo.trim(),
        publicado: publicado || '',
        descricao: descricao || '',
        ehShort: link.includes('/shorts/'),
      });
    }
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

/**
 * DATA DO PROGRAMA
 * Vale a data que você escreve na DESCRIÇÃO do vídeo (ex.: "Programa do dia
 * 18 de outubro de 2026" ou "18/10/2026"). Assim, se você subir hoje o
 * programa do sábado passado, ele NÃO passa na frente do mais novo.
 * Ordem de procura: descrição → título → data em que o vídeo foi publicado.
 */
const MESES = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** Acha a primeira data completa (dia, mês e ano) num texto. Devolve "AAAA-MM-DD" ou ''. */
function acharData(texto) {
  const t = normalizar(texto);

  // "18 de outubro de 2026" / "18 de outubro 2026"
  const porExtenso = t.match(
    /\b(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*,?\s*(?:de\s+)?(\d{4})\b/
  );
  // "18/10/2026", "18-10-2026", "18.10.2026" ou com ano de 2 dígitos ("18/10/26")
  const numerica = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})\b/);

  const candidatos = [];
  if (porExtenso) {
    candidatos.push({ pos: porExtenso.index, d: +porExtenso[1], m: MESES[porExtenso[2]], a: +porExtenso[3] });
  }
  if (numerica) {
    const ano = numerica[3].length === 2 ? 2000 + +numerica[3] : +numerica[3];
    candidatos.push({ pos: numerica.index, d: +numerica[1], m: +numerica[2], a: ano });
  }
  const valido = candidatos
    .filter((c) => c.m >= 1 && c.m <= 12 && c.d >= 1 && c.d <= 31 && c.a >= 2020 && c.a <= 2100)
    .sort((x, y) => x.pos - y.pos)[0];
  if (!valido) return '';
  return `${valido.a}-${String(valido.m).padStart(2, '0')}-${String(valido.d).padStart(2, '0')}`;
}

function dataDoPrograma(v) {
  return acharData(v.descricao) || acharData(v.titulo) || String(v.publicado || '').slice(0, 10);
}

const PALAVRAS_DE_CORTE = ['#shorts', 'corte', 'trecho', 'melhores momentos'];

function pontuacao(v) {
  const t = normalizar(v.titulo);
  if (t.includes('programa completo')) return 2;
  if (t.includes('programa')) return 1;
  return 0;
}

/**
 * Fica só com os vídeos do programa, do programa MAIS RECENTE para o mais antigo
 * (pela data do programa, não pela data de publicação).
 *  - Shorts e cortes ficam de fora.
 *  - Se tiver mais de um vídeo do MESMO programa (mesma data), fica o
 *    "Programa Completo"; depois o que tem "Programa" no título.
 */
function filtrarPrograma(videos) {
  const doPrograma = videos
    .filter((v) => {
      const t = normalizar(v.titulo);
      if (v.ehShort) return false;
      if (!t.includes('voz do motorista')) return false;
      return !PALAVRAS_DE_CORTE.some((p) => t.includes(p));
    })
    .map((v, ordem) => ({ ...v, dataPrograma: dataDoPrograma(v), ordem }));
  if (!doPrograma.length) return [];

  // Um vídeo por data de programa (o de maior pontuação)
  const porData = new Map();
  for (const v of doPrograma) {
    const chave = v.dataPrograma || `sem-data-${v.ordem}`;
    const atual = porData.get(chave);
    if (!atual || pontuacao(v) > pontuacao(atual)) porData.set(chave, v);
  }

  return [...porData.values()]
    .sort((a, b) => {
      if (a.dataPrograma && b.dataPrograma) return b.dataPrograma.localeCompare(a.dataPrograma);
      if (a.dataPrograma || b.dataPrograma) return a.dataPrograma ? -1 : 1;
      return a.ordem - b.ordem; // sem data nenhuma: mantém a ordem do YouTube
    })
    .map(({ videoId, titulo, publicado, dataPrograma }) => ({ videoId, titulo, publicado, dataPrograma }));
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
  // Mostra no registro os títulos que vieram, pra ficar fácil entender a escolha
  todos.slice(0, 8).forEach((v) => {
    const dataProg = acharData(v.descricao) || acharData(v.titulo);
    console.log(
      `     - publicado ${v.publicado ? v.publicado.slice(0, 10) : '?'} | programa ${dataProg || 'sem data na descrição'} | ${v.ehShort ? '[short] ' : ''}${v.titulo}`
    );
  });

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
      : `✅ Vídeo novo em destaque: "${novo.titulo}" (${novo.videoId}) — programa de ${novo.dataPrograma || 'data não informada'}`
  );
}

main().catch((erro) => {
  console.error('❌ Erro:', erro.message);
  process.exit(1);
});
