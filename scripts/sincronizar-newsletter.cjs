/**
 * Sincroniza os cadastros da Newsletter (Firestore) com uma Google Planilha.
 *
 * Lê todos os documentos da coleção "newsletter", confere quais e-mails já
 * estão na planilha (pra nunca duplicar linha), e acrescenta só os novos.
 *
 * CONFIGURAÇÃO NECESSÁRIA (uma vez só):
 * 1) Ativar a API do Google Sheets no projeto do Firebase:
 *    https://console.cloud.google.com/apis/library/sheets.googleapis.com
 *    (confirma que o projeto selecionado no topo é o "tra-v5")
 * 2) Compartilhar a planilha com o e-mail da conta de serviço do Firebase
 *    (o mesmo "client_email" que está dentro da chave FIREBASE_SERVICE_ACCOUNT_BASE64),
 *    dando permissão de Editor. Esse e-mail parece com:
 *    firebase-adminsdk-xxxxx@tra-v5.iam.gserviceaccount.com
 *
 * COMO USAR:
 *   node scripts/sincronizar-newsletter.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
// Inscritos agora ficam na planilha principal (arquivos_nuvem_tra), numa aba
// própria "Newsletter" — criada automaticamente na 1ª vez.
// (Antes ficavam na planilha 192gf5Sg6ViGDcoxDdUCQmm6cWsGUDpLwpc87KwBtX5s, aba "Página1".)
const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg';
const ABA = 'Newsletter';
const CABECALHO = ['Nome', 'E-mail', 'Data do cadastro'];

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
  // Formato em objeto: a versão atual da biblioteca googleapis não aceita
  // mais o formato antigo (email, null, chave, escopos) — ele falhava calado.
  const auth = new google.auth.JWT({
    email: credencial.client_email,
    key: credencial.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

/** Formata a data de criação (pode vir como string ISO ou Timestamp do Firestore) */
function formatarData(criadoEm) {
  try {
    const data = criadoEm?.toDate ? criadoEm.toDate() : new Date(criadoEm);
    if (isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

async function garantirAba(sheets) {
  const planilha = await sheets.spreadsheets.get({ spreadsheetId: PLANILHA_ID });
  if (planilha.data.sheets.some((s) => s.properties.title === ABA)) return;
  console.log(`Aba "${ABA}" não existe ainda — criando...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILHA_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: ABA, gridProperties: { frozenRowCount: 1 } } } }] },
  });
}

async function main() {
  const sheets = await autenticarGoogleSheets();
  await garantirAba(sheets);

  // Lê o que já existe na planilha, pra saber quais e-mails já foram
  // adicionados antes e não duplicar linha.
  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILHA_ID,
    range: `'${ABA}'!A:C`,
  });
  const linhasAtuais = resposta.data.values || [];
  const temCabecalho = linhasAtuais.length > 0 && linhasAtuais[0][0] === CABECALHO[0];
  const linhasDeDados = temCabecalho ? linhasAtuais.slice(1) : linhasAtuais;
  const emailsExistentes = new Set(linhasDeDados.map((linha) => (linha[1] || '').toLowerCase().trim()));

  // Se a planilha está vazia, cria o cabeçalho primeiro.
  if (linhasAtuais.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: PLANILHA_ID,
      range: `'${ABA}'!A:C`,
      valueInputOption: 'RAW',
      requestBody: { values: [CABECALHO] },
    });
  }

  const snapshot = await db.collection('newsletter').get();
  console.log(`Total de cadastros na newsletter: ${snapshot.size}`);

  const linhasNovas = [];
  snapshot.docs.forEach((doc) => {
    const dados = doc.data();
    const email = (dados.email || '').toLowerCase().trim();
    if (!email || emailsExistentes.has(email)) return;

    linhasNovas.push([dados.nome || '-', dados.email || '-', formatarData(dados.criadoEm)]);
    emailsExistentes.add(email);
  });

  if (linhasNovas.length === 0) {
    console.log('Nenhum e-mail novo pra adicionar — planilha já está atualizada.');
    return;
  }

  await sheets.spreadsheets.values.append({
    spreadsheetId: PLANILHA_ID,
    range: `'${ABA}'!A:C`,
    valueInputOption: 'RAW',
    requestBody: { values: linhasNovas },
  });

  console.log(`🎉 Concluído! ${linhasNovas.length} e-mail(s) novo(s) adicionado(s) na planilha.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao sincronizar newsletter:', erro);
  process.exit(1);
});
