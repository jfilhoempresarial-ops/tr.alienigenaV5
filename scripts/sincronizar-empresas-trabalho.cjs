/**
 * Sincroniza a aba "Relação Empresas" (na planilha "arquivos_nuvem_tra") com
 * a coleção "empresas" do Firestore, na categoria "trabalho" — usada pelo
 * Ranking das Empresas (/ranking).
 *
 * COMO USAR:
 *   Na planilha, aba "Relação Empresas": coluna A = Empresas (nome),
 *   coluna B = Cidade (opcional), coluna C = Estado (opcional).
 *
 *   - Adicionar uma linha = a empresa aparece no ranking (com nota 0 até
 *     receber a primeira avaliação).
 *   - Apagar uma linha = a empresa some do ranking (e as avaliações dela
 *     também são apagadas do banco).
 *   - Editar cidade/estado de uma linha existente atualiza esses dados.
 *
 * Se a aba "Empresas Trabalho" ainda não existir na planilha, o script cria
 * ela sozinho na primeira vez.
 *
 * COMO USAR:
 *   node scripts/sincronizar-empresas-trabalho.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg';
const ABA = 'Relação Empresas';
const CABECALHO = ['Empresas', 'Cidade', 'Estado'];
const CATEGORIA_TRABALHO = 'trabalho';
const ORIGEM = 'planilha-trabalho';

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

const credencial = carregarCredencial();

initializeApp({
  credential: cert(credencial),
});
const db = getFirestore();

async function autenticarGoogleSheets() {
  const auth = new google.auth.JWT(
    credencial.client_email,
    null,
    credencial.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

async function garantirAba(sheets) {
  const planilha = await sheets.spreadsheets.get({ spreadsheetId: PLANILHA_ID });
  const jaExiste = planilha.data.sheets.some((s) => s.properties.title === ABA);
  if (jaExiste) return;

  console.log(`Aba "${ABA}" não existe ainda — criando...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILHA_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: ABA } } }] },
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: PLANILHA_ID,
    range: `${ABA}!A:C`,
    valueInputOption: 'RAW',
    requestBody: { values: [CABECALHO] },
  });
}

/** Gera um ID de documento estável a partir do nome da empresa. */
function gerarId(nome) {
  const texto = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `trabalho-${texto}`;
}

async function main() {
  const sheets = await autenticarGoogleSheets();
  await garantirAba(sheets);

  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILHA_ID,
    range: `${ABA}!A:C`,
  });
  const linhasAtuais = resposta.data.values || [];
  const temCabecalho = linhasAtuais.length > 0 && linhasAtuais[0][0] === CABECALHO[0];
  const linhasDeDados = temCabecalho ? linhasAtuais.slice(1) : linhasAtuais;

  console.log(`Total de linhas na planilha: ${linhasDeDados.length}`);

  let novas = 0;
  let atualizadas = 0;
  const idsDaPlanilha = new Set();

  for (const linha of linhasDeDados) {
    const nome = (linha[0] || '').trim();
    if (!nome) continue;

    const cidade = (linha[1] || '').trim();
    const estado = (linha[2] || '').trim().toUpperCase();
    const id = gerarId(nome);
    idsDaPlanilha.add(id);

    const dados = {
      nome,
      categorias: [CATEGORIA_TRABALHO],
      verificado: true,
      origem: ORIGEM,
    };
    if (cidade) dados.cidade = cidade;
    if (estado) dados.estado = estado;

    const docRef = db.collection('empresas').doc(id);
    const existente = await docRef.get();
    await docRef.set(dados, { merge: true });

    if (existente.exists) {
      atualizadas++;
    } else {
      novas++;
      console.log(`✅ Nova: ${nome}`);
    }
  }

  // Remove quem saiu da planilha (só mexe em quem tem a origem certa —
  // nunca em empresas cadastradas de outro jeito).
  const snapshot = await db.collection('empresas').where('origem', '==', ORIGEM).get();
  const idsParaRemover = snapshot.docs.map((doc) => doc.id).filter((id) => !idsDaPlanilha.has(id));

  if (idsParaRemover.length > 0) {
    console.log(`🗑️  Removendo ${idsParaRemover.length} empresa(s) que saíram da planilha:`);
    for (const id of idsParaRemover) {
      console.log(`   - ${id}`);
      // Remove também as avaliações dessa empresa, pra não ficar lixo.
      const avaliacoesSnap = await db.collection('avaliacoes').where('empresaId', '==', id).get();
      const batch = db.batch();
      avaliacoesSnap.docs.forEach((doc) => batch.delete(doc.ref));
      batch.delete(db.collection('empresas').doc(id));
      await batch.commit();
    }
  }

  console.log(`\n🎉 Concluído! ${novas} nova(s), ${atualizadas} atualizada(s), ${idsParaRemover.length} removida(s).`);
}

main().catch((erro) => {
  console.error('❌ Erro ao sincronizar empresas de trabalho:', erro);
  process.exit(1);
});
