/**
 * Script: busca a lista de vídeos da playlist "A Voz do Motorista" no
 * YouTube (sem precisar de chave de API, usando o yt-dlp) e salva no
 * Firestore, em configuracoes/playlist-motorista, campo "musicas".
 *
 * Roda sozinho via GitHub Actions (uma vez por dia + manual), veja
 * .github/workflows/atualizar-playlist.yml
 *
 * COMO USAR (manual, no seu PC):
 *   1. Instale o yt-dlp: pip install yt-dlp  (ou: pip3 install yt-dlp)
 *   2. node scripts/importar-playlist.cjs
 */

const path = require('path');
const { execSync } = require('child_process');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const PLAYLIST_URL = 'https://youtube.com/playlist?list=PLTSwVGOcyE2YhpBBtC62aI0JFe33TWpYt';

// No GitHub Actions, a chave vem da secret em base64. Rodando local no
// seu PC, usa o arquivo serviceAccountKey.json direto (não versionado).
function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');
  return require(CAMINHO_CHAVE);
}

initializeApp({
  credential: cert(carregarCredencial()),
});
const db = getFirestore();

async function main() {
  console.log('🔎 Buscando vídeos da playlist via yt-dlp...');

  const saida = execSync(`yt-dlp --flat-playlist -J "${PLAYLIST_URL}"`, {
    maxBuffer: 1024 * 1024 * 20,
  }).toString();

  const dados = JSON.parse(saida);
  const musicas = (dados.entries || [])
    .filter((v) => v && v.id)
    .map((v) => ({
      id: v.id,
      titulo: v.title || 'Sem título',
      miniatura: `https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`,
    }));

  if (musicas.length === 0) {
    throw new Error('Nenhum vídeo encontrado na playlist — algo pode ter mudado no link ou na playlist.');
  }

  await db.collection('configuracoes').doc('playlist-motorista').set({
    musicas,
    atualizadoEm: new Date().toISOString(),
  });

  console.log(`✅ ${musicas.length} música(s) salvas no Firestore.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar playlist:', erro);
  process.exit(1);
});
