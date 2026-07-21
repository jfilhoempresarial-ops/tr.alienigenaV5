/**
 * Script de correção única (rodar uma vez, não precisa agendar): varre a
 * coleção "noticias" já existente no Firestore e troca o imagemUrl de
 * qualquer notícia que ainda esteja com o ícone genérico do Google News
 * (de antes da correção no buscar-noticias-google.cjs) pela logo TRA News.
 *
 * Não busca nada novo no Google News — só limpa o que já está gravado.
 *
 * COMO USAR:
 *   node scripts/corrigir-imagens-noticias.cjs
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');
const IMAGEM_PADRAO = '/images/tra-news-logo.png';

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

initializeApp({
  credential: cert(carregarCredencial()),
});
const db = getFirestore();

function ehImagemDoGoogle(url) {
  if (!url) return false;
  return /(^|\.)google(usercontent)?\.com|gstatic\.com/i.test(url);
}

async function main() {
  const snapshot = await db.collection('noticias').get();

  let corrigidas = 0;
  let verificadas = 0;

  for (const doc of snapshot.docs) {
    verificadas++;
    const dados = doc.data();
    if (ehImagemDoGoogle(dados.imagemUrl)) {
      await doc.ref.update({ imagemUrl: IMAGEM_PADRAO });
      corrigidas++;
      console.log(`✅ Corrigida: ${dados.titulo}`);
    }
  }

  console.log(`\n🎉 Concluído! ${verificadas} notícias verificadas, ${corrigidas} corrigidas.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao corrigir imagens:', erro);
  process.exit(1);
});
