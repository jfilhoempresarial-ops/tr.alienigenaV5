/**
 * Script de limpeza única: apaga da coleção "empresas" do Firestore todo
 * documento SEM latitude/longitude — pra ficar alinhado com o
 * prestadores.csv, de onde você já removeu as linhas sem coordenada.
 *
 * EXCEÇÃO: nunca apaga documentos com origem "ppd-gov-br" (os Pontos de
 * Parada e Descanso oficiais), mesmo que estejam sem coordenada — isso foi
 * pedido explicitamente antes, já que a geocodificação por cidade pode
 * falhar ocasionalmente pra algum PPD, e isso não deve custar o cadastro
 * dele.
 *
 * MODO SIMULAÇÃO POR PADRÃO: com APLICAR_MUDANCAS = false, o script só
 * MOSTRA quem seria apagado (nada é alterado). Depois de conferir o log,
 * troque para true e rode de novo pra aplicar de verdade.
 *
 * COMO USAR:
 *   node scripts/apagar-empresas-sem-coordenada.cjs
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

// Troque para true depois de conferir o log da simulação.
const APLICAR_MUDANCAS = true;

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

function temCoordenadaValida(dados) {
  return typeof dados.lat === 'number' && typeof dados.lng === 'number';
}

async function main() {
  const snapshot = await db.collection('empresas').get();

  const paraApagar = [];
  snapshot.docs.forEach((doc) => {
    const dados = doc.data();
    if (dados.origem === 'ppd-gov-br') return; // nunca apaga PPD, mesmo sem coordenada
    if (!temCoordenadaValida(dados)) {
      paraApagar.push({ id: doc.id, nome: dados.nome });
    }
  });

  console.log(`Total de documentos na coleção: ${snapshot.size}`);
  console.log(`Sem coordenada (candidatos a apagar, exceto PPD): ${paraApagar.length}`);
  console.log(`Modo: ${APLICAR_MUDANCAS ? '⚠️  APAGANDO DE VERDADE' : '🔎 SIMULAÇÃO (nada será apagado)'}\n`);

  for (const item of paraApagar) {
    console.log(`- ${item.nome} (${item.id})`);
    if (APLICAR_MUDANCAS) {
      await db.collection('empresas').doc(item.id).delete();
    }
  }

  console.log(`\n🎉 Concluído!`);
  if (!APLICAR_MUDANCAS) {
    console.log('\nEsse foi um teste (simulação). Confira a lista acima e, se estiver tudo certo,');
    console.log('troque APLICAR_MUDANCAS para true no topo do arquivo e rode de novo pra apagar de verdade.');
  } else {
    console.log(`${paraApagar.length} empresas apagadas.`);
  }
}

main().catch((erro) => {
  console.error('❌ Erro:', erro);
  process.exit(1);
});
