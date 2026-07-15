/**
 * Script de importação: lê um CSV de aniversariantes (relatório de
 * cadastros do Bling) e cadastra cada um na coleção "aniversariantes"
 * do Firestore.
 *
 * COMO USAR:
 * 1. Coloque este arquivo dentro da pasta "scripts/" do projeto.
 * 2. Coloque seu CSV dentro de "scripts/", com o nome "aniversariantes.csv".
 *    Colunas esperadas: Nome, Dia, Mes (números, sem ano).
 * 3. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/importar-aniversariantes.cjs
 *
 * Você pode rodar este script sempre que atualizar a lista de clientes —
 * ele LIMPA a coleção antiga e sobe a lista nova por completo, então é
 * sempre a "foto atual" da sua base, sem duplicar ninguém.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CSV = path.join(__dirname, 'aniversariantes.csv');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
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
  const conteudoCsv = fs.readFileSync(CAMINHO_CSV, 'utf-8');
  const linhas = parse(conteudoCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  console.log(`\nTotal de linhas no CSV: ${linhas.length}`);

  await limparColecao();

  let enviados = 0;
  let puladas = 0;
  for (const linha of linhas) {
    const nome = linha['Nome'];
    const dia = parseInt(linha['Dia'], 10);
    const mes = parseInt(linha['Mes'], 10);

    if (!nome || !dia || !mes) {
      puladas++;
      continue;
    }

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