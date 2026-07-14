/**
 * Script de importação: lê um CSV de cargas/fretes disponíveis
 * e cadastra cada combinação de veículo+carroceria como um documento
 * separado na coleção "fretes" do Firestore.
 *
 * COMO USAR:
 * 1. Coloque este arquivo dentro da pasta "scripts/" do projeto.
 * 2. Coloque seu CSV (com as colunas: Cidade Origem, Estado Origem,
 *    Cidade Destino, Estado Destino, Carga, Espécie, Veículo, Carroceria)
 *    dentro de "scripts/", com o nome "fretes.csv".
 * 3. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/importar-fretes.cjs
 *
 * Cada linha do CSV pode ter VÁRIOS veículos e VÁRIAS carrocerias
 * separados por vírgula (ex: "Carreta LS, Bitrem 7 eixos"). O script
 * cria um card separado para cada combinação possível.
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ---------- CONFIGURAÇÃO ----------
const CAMINHO_CSV = path.join(__dirname, 'fretes.csv');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

// Se true, apaga todos os fretes já cadastrados antes de importar os novos.
// Use true quando quiser SUBSTITUIR a lista antiga por uma nova.
// Use false quando quiser apenas ADICIONAR novos fretes aos que já existem.
const LIMPAR_ANTES_DE_IMPORTAR = true;
// -----------------------------------

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
});
const db = getFirestore();

function dividirLista(campo) {
  if (!campo) return [];
  return campo
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

async function limparColecao() {
  const snapshot = await db.collection('fretes').get();
  if (snapshot.empty) return;
  console.log(`🗑️  Removendo ${snapshot.size} fretes antigos...`);
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

  const combinacoes = [];
  let puladas = 0;

  for (const linha of linhas) {
    const cidadeOrigem = linha['Cidade Origem'];
    const estadoOrigem = linha['Estado Origem'];
    const cidadeDestino = linha['Cidade Destino'];
    const estadoDestino = linha['Estado Destino'];
    const carga = linha['Carga'];
    const especie = linha['Espécie'];
    const veiculos = dividirLista(linha['Veículo']);
    const carrocerias = dividirLista(linha['Carroceria']);

    if (!cidadeOrigem || !cidadeDestino || veiculos.length === 0 || carrocerias.length === 0) {
      puladas++;
      continue;
    }

    for (const veiculo of veiculos) {
      for (const carroceria of carrocerias) {
        combinacoes.push({
          cidadeOrigem: cidadeOrigem.trim(),
          estadoOrigem: (estadoOrigem || '').trim(),
          cidadeDestino: cidadeDestino.trim(),
          estadoDestino: (estadoDestino || '').trim(),
          carga: (carga || '').trim(),
          especie: (especie || '').trim(),
          veiculo,
          carroceria,
          criadoEm: new Date().toISOString(),
          origem: 'importacao-csv',
        });
      }
    }
  }

  console.log(`Combinações veículo+carroceria geradas: ${combinacoes.length}`);
  console.log(`Linhas puladas (incompletas): ${puladas}\n`);

  if (LIMPAR_ANTES_DE_IMPORTAR) {
    await limparColecao();
  }

  let enviadas = 0;
  for (const dados of combinacoes) {
    await db.collection('fretes').add(dados);
    enviadas++;
    console.log(
      `✅ (${enviadas}) ${dados.cidadeOrigem}/${dados.estadoOrigem} → ${dados.cidadeDestino}/${dados.estadoDestino} — ${dados.veiculo} / ${dados.carroceria}`
    );
  }

  console.log(`\n🎉 Concluído! ${enviadas} fretes cadastrados no Firestore.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});