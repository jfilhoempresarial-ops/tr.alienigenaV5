/**
 * Script de importação: lê o arquivo scripts/minhas-noticias.json e
 * cadastra (ou atualiza) cada notícia própria na coleção "noticias"
 * do Firestore, já marcando autor: "J Filho" e ativo: true.
 *
 * Roda sozinho via GitHub Actions sempre que você commitar uma
 * mudança em scripts/minhas-noticias.json (veja
 * .github/workflows/atualizar-noticias.yml).
 *
 * COMO USAR (formato do JSON):
 * [
 *   {
 *     "id": "identificador-unico-sem-espaco",
 *     "titulo": "Título da notícia",
 *     "texto": "Texto completo. Use uma linha em branco para separar parágrafos.",
 *     "imagemUrl": "/images/noticias/nome-do-arquivo.jpg",
 *     "categoria": "geral" (ou: mobilizacao, rodovia, seguranca, direitos),
 *     "data": "AAAA-MM-DD"
 *   }
 * ]
 *
 * COMO USAR (manual, se precisar rodar no seu PC):
 *   node scripts/importar-minhas-noticias.cjs
 */

const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_JSON = path.join(__dirname, 'minhas-noticias.json');

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
  const conteudo = fs.readFileSync(CAMINHO_JSON, 'utf-8');
  const noticias = JSON.parse(conteudo);

  let enviadas = 0;
  for (const noticia of noticias) {
    const { id, ...dados } = noticia;

    if (!id) {
      console.warn('⚠️  Notícia sem "id", pulando:', dados.titulo);
      continue;
    }

    await db.collection('noticias').doc(id).set({
      ...dados,
      autor: 'J Filho',
      ativo: true,
    });

    enviadas++;
    console.log(`✅ (${enviadas}) [${dados.categoria}] ${dados.titulo}`);
  }

  console.log(`\n🎉 Concluído! ${enviadas} notícia(s) própria(s) cadastrada(s) no Firestore.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar minhas notícias:', erro);
  process.exit(1);
});
