/**
 * Atualiza a fita de cotações do topo do site.
 *
 * - Dólar: busca automático, direto da AwesomeAPI (gratuita, sem chave).
 * - Diesel, Gasolina, Etanol, Petróleo (Brent): lidos da aba "Cotações" na
 *   planilha "arquivos_nuvem_tra" — ATUALIZE ESSES VALORES TODA SEXTA-FEIRA,
 *   quando a ANP libera o novo levantamento semanal (ou de qualquer fonte
 *   de sua confiança). Não tem API gratuita confiável pra isso no Brasil,
 *   por isso esses aqui são manuais.
 *
 * A aba "Cotações" tem 3 colunas: Item | Valor | Unidade
 * Exemplo de linhas:
 *   Diesel     | 6,25  | R$/L
 *   Gasolina   | 6,89  | R$/L
 *   Etanol     | 4,50  | R$/L
 *   Petróleo   | 82,10 | US$/barril
 *
 * Se a aba ainda não existir, o script cria ela sozinho (vazia, com
 * cabeçalho) na primeira vez — você só precisa preencher as linhas depois.
 *
 * COMO USAR:
 *   node scripts/sincronizar-cotacoes.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg';
const ABA = 'Cotações';
const CABECALHO = ['Item', 'Valor', 'Unidade'];

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
    requestBody: {
      values: [
        CABECALHO,
        ['Diesel', '', 'R$/L'],
        ['Gasolina', '', 'R$/L'],
        ['Etanol', '', 'R$/L'],
        ['Petróleo', '', 'US$/barril'],
      ],
    },
  });
}

/** Busca o dólar comercial (USD -> BRL) na AwesomeAPI, gratuita e sem chave. */
async function buscarDolar() {
  try {
    const resposta = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
    if (!resposta.ok) throw new Error(`AwesomeAPI respondeu ${resposta.status}`);
    const dados = await resposta.json();
    const bid = parseFloat(dados.USDBRL.bid);
    return { label: 'Dólar', valor: bid.toFixed(2).replace('.', ','), unidade: 'R$' };
  } catch (erro) {
    console.warn('Não foi possível buscar o dólar automaticamente:', erro.message);
    return null;
  }
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

  const itensDaPlanilha = linhasDeDados
    .filter((linha) => (linha[0] || '').trim() && (linha[1] || '').trim())
    .map((linha) => ({
      label: linha[0].trim(),
      valor: linha[1].trim(),
      unidade: (linha[2] || '').trim(),
    }));

  const dolar = await buscarDolar();
  const itens = dolar ? [dolar, ...itensDaPlanilha] : itensDaPlanilha;

  if (itens.length === 0) {
    console.log('Nenhuma cotação disponível ainda (preencha a aba "Cotações" na planilha).');
    return;
  }

  await db.collection('configuracoes').doc('cotacoes').set({
    itens,
    atualizadoEm: new Date().toISOString(),
  });

  console.log(`🎉 Concluído! ${itens.length} cotação(ões) atualizada(s):`);
  itens.forEach((item) => console.log(`   ${item.label}: ${item.unidade} ${item.valor}`));
}

main().catch((erro) => {
  console.error('❌ Erro ao sincronizar cotações:', erro);
  process.exit(1);
});
