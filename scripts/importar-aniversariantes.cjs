/**
 * Script de importação: lê a planilha de aniversariantes em XLSX
 * (primeira aba do arquivo, colunas "Nome" e "Data nascimento") e
 * cadastra cada um na coleção "aniversariantes" do Firestore.
 *
 * COMO USAR:
 * 1. Coloque este arquivo dentro da pasta "scripts/" do projeto.
 * 2. Salve sua planilha atualizada como "scripts/aniversariantes.xlsx"
 *    (substituindo a anterior).
 * 3. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/importar-aniversariantes.cjs
 *
 * Roda sozinho via GitHub Actions sempre que você atualizar o
 * scripts/aniversariantes.xlsx (veja .github/workflows/atualizar-aniversariantes.yml).
 *
 * Você pode rodar este script sempre que atualizar a lista de clientes —
 * ele LIMPA a coleção antiga e sobe a lista nova por completo, então é
 * sempre a "foto atual" da sua base, sem duplicar ninguém.
 */

const path = require('path');
const XLSX = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_XLSX = path.join(__dirname, 'aniversariantes.xlsx');

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

async function limparColecao() {
  const snapshot = await db.collection('aniversariantes').get();
  if (snapshot.empty) return;
  console.log(`🗑️  Removendo ${snapshot.size} aniversariantes antigos...`);
  const lotes = [];
  let lote = db.batch();
  let contador = 0;
  snapshot.docs.forEach((doc) => {
    lote.delete(doc.ref);
    contador++;
    if (contador === 400) {
      lotes.push(lote.commit());
      lote = db.batch();
      contador = 0;
    }
  });
  if (contador > 0) lotes.push(lote.commit());
  await Promise.all(lotes);
}

async function main() {
  const workbook = XLSX.readFile(CAMINHO_XLSX, { cellDates: true });

  const nomeAba = workbook.SheetNames[0];
  if (!nomeAba) {
    throw new Error('A planilha não tem nenhuma aba.');
  }

  const planilha = workbook.Sheets[nomeAba];
  const linhas = XLSX.utils.sheet_to_json(planilha, { defval: null });

  console.log(`\nUsando a aba "${nomeAba}". Total de linhas: ${linhas.length}`);

  await limparColecao();

  let enviados = 0;
  let puladas = 0;
  for (const linha of linhas) {
    const nome = linha['Nome'];
    const dataNascimento = linha['Data nascimento'];

    if (!nome || !dataNascimento || !(dataNascimento instanceof Date)) {
      puladas++;
      continue;
    }

    const dia = dataNascimento.getDate();
    const mes = dataNascimento.getMonth() + 1;

    await db.collection('aniversariantes').add({ nome: nome.trim(), dia, mes });
    enviados++;
    console.log(`✅ (${enviados}) ${nome.trim()} — ${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`);
  }

  console.log(`\n🎉 Concluído! ${enviados} aniversariantes cadastrados. Linhas puladas: ${puladas}`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});
