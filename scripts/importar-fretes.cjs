/**
 * Script de importação: lê a planilha de cargas/fretes (recebida
 * diariamente) e cadastra cada combinação de veículo+carroceria como um
 * documento separado na coleção "fretes" do Firestore.
 *
 * Classifica automaticamente cada frete em "ceara" (quando origem OU
 * destino é no Ceará) ou "outros" (nenhum dos dois é CE) — isso alimenta
 * os dois grupos separados que aparecem na página /fretes do site.
 *
 * COMO USAR (local, no seu computador):
 * 1. Coloque a planilha recebida dentro de "scripts/", com o nome
 *    "cargas.xlsx" (mesmo formato de sempre).
 * 2. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/importar-fretes.cjs
 *
 * TAMBÉM RODA AUTOMATICAMENTE pelo GitHub Actions 1x por dia
 * (veja .github/workflows/atualizar-fretes.yml), usando a mesma planilha
 * "cargas.xlsx" que estiver commitada no repositório naquele momento.
 *
 * Este script LIMPA a coleção antiga e sobe a lista nova por completo —
 * rode sempre que receber uma planilha atualizada (ou apenas commite o
 * arquivo novo e deixe a automação rodar sozinha no próximo horário).
 */

const path = require('path');
const XLSX = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_PLANILHA = path.join(__dirname, 'cargas.xlsx');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

/**
 * Autenticação dupla:
 * - No GitHub Actions, usa a variável de ambiente FIREBASE_SERVICE_ACCOUNT_BASE64
 *   (mesma já configurada como secret pro scraper de vagas).
 * - Localmente, usa o arquivo serviceAccountKey.json na pasta scripts/.
 */
function obterCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

initializeApp({
  credential: cert(obterCredencial()),
});
const db = getFirestore();

function dividirLista(campo) {
  if (!campo) return [];
  return campo
    .toString()
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function dividirCidadeEstado(campo) {
  const partes = (campo || '').toString().split(' - ');
  if (partes.length < 2) return { cidade: campo || '', estado: '' };
  const estado = partes.pop().trim();
  const cidade = partes.join(' - ').trim();
  return { cidade, estado };
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
  const workbook = XLSX.readFile(CAMINHO_PLANILHA);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  console.log(`\nTotal de linhas na planilha: ${linhas.length}`);

  const combinacoes = [];
  let puladas = 0;

  for (const linha of linhas) {
    const origem = dividirCidadeEstado(linha['Origem']);
    const destino = dividirCidadeEstado(linha['Destino']);
    const carga = (linha['Carga'] || '').toString().trim();
    const especie = (linha['Espécie'] || '').toString().trim();
    const veiculos = dividirLista(linha['Veículo']);
    const carrocerias = dividirLista(linha['Carroceria']);
    const preco = (linha['Preço'] || '').toString().trim();
    const pesoTon = linha['Peso (ton)'] || null;
    const obs = (linha['Obs.'] || '').toString().trim();

    if (!origem.cidade || !destino.cidade || veiculos.length === 0 || carrocerias.length === 0) {
      puladas++;
      continue;
    }

    const regiao = origem.estado === 'CE' || destino.estado === 'CE' ? 'ceara' : 'outros';

    for (const veiculo of veiculos) {
      for (const carroceria of carrocerias) {
        combinacoes.push({
          cidadeOrigem: origem.cidade,
          estadoOrigem: origem.estado,
          cidadeDestino: destino.cidade,
          estadoDestino: destino.estado,
          carga,
          especie,
          veiculo,
          carroceria,
          preco: preco || null,
          pesoTon: pesoTon || null,
          obs: obs || null,
          regiao,
          criadoEm: new Date().toISOString(),
          origem: 'importacao-planilha',
        });
      }
    }
  }

  const totalCeara = combinacoes.filter((c) => c.regiao === 'ceara').length;
  const totalOutros = combinacoes.filter((c) => c.regiao === 'outros').length;

  console.log(`Combinações geradas: ${combinacoes.length} (Ceará: ${totalCeara} • Outros estados: ${totalOutros})`);
  console.log(`Linhas puladas (incompletas): ${puladas}\n`);

  await limparColecao();

  let enviadas = 0;
  for (const dados of combinacoes) {
    await db.collection('fretes').add(dados);
    enviadas++;
    console.log(
      `✅ (${enviadas}) [${dados.regiao}] ${dados.cidadeOrigem}/${dados.estadoOrigem} → ${dados.cidadeDestino}/${dados.estadoDestino} — ${dados.veiculo} / ${dados.carroceria}`
    );
  }

  console.log(`\n🎉 Concluído! ${enviadas} fretes cadastrados no Firestore.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});