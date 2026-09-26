/**
 * Copia os prestadores que se cadastraram SOZINHOS pelo site (formulário
 * "Cadastre-se") para uma aba própria na planilha do Google:
 *
 *   Planilha: arquivos_nuvem_tra
 *   Aba:      "Cadastros pelo Site"  (criada automaticamente na 1ª vez)
 *
 * É só um ESPELHO para consulta — o caminho é sempre site → planilha:
 *   - Pendentes e aprovados aparecem, com a coluna "Status".
 *   - Recusou no /admin? Some da aba na próxima rodada.
 *   - Editar algo AQUI não muda nada no site (a aba é reescrita a cada
 *     rodada). Para mudar dados, use o /admin.
 *   - Essa aba NÃO é lida pelo robô dos prestadores (ele só lê a aba
 *     "Prestadores"), então não existe risco de duplicar empresa no site.
 *
 * Roda pelo GitHub Actions (workflow "Atualizar Cadastros pelo Site").
 * Teste local: node scripts/exportar-cadastros-site.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg'; // arquivos_nuvem_tra
const ABA = 'Cadastros pelo Site';
const COLLECTION = 'empresas';
const ORIGEM_SITE = 'cadastro-site';

const CABECALHO = [
  'Status',
  'Data do cadastro',
  'Empresa',
  'Categorias',
  'Especialidades / Serviço',
  'Horário de atendimento',
  'WhatsApp',
  'Telefone',
  'Instagram',
  'Endereço',
  'Latitude/Longitude',
  'Ver no mapa',
  'Fotos',
];

// Mesmos nomes do formulário de cadastro (src/pages/cadastro-empresa.js)
const NOME_CATEGORIA = {
  mecanico: 'Mecânico',
  eletrica: 'Elétrica',
  borracharia: 'Borracharia',
  guincho: 'Guincho/Socorro',
  posto: 'Posto/Conveniência',
  lavajato: 'Lava-Jato',
  pontoapoio: 'Ponto de Apoio',
  autopecas: 'Auto Peças',
  tacografo: 'Tacógrafo',
  molas: 'Molas e Suspensão',
  funilaria: 'Funilaria e Retífica',
  vidros: 'Vidros e Para-brisa',
  restaurante: 'Restaurante e Hospedagem',
  financiamento: 'Outros Serviços',
};

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

const credencial = carregarCredencial();
initializeApp({ credential: cert(credencial) });
const db = getFirestore();

async function autenticarGoogleSheets() {
  const auth = new google.auth.JWT({
    email: credencial.client_email,
    key: credencial.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
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

// criadoEm pode estar como texto ISO ou Timestamp do Firestore
function lerData(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatarData(d) {
  if (!d) return '';
  // Horário de Brasília
  return d.toLocaleString('pt-BR', {
    timeZone: 'America/Fortaleza',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function montarLinha(e) {
  const temCoordenada = typeof e.lat === 'number' && typeof e.lng === 'number';
  const fotos = Array.isArray(e.fotos) ? e.fotos.filter(Boolean) : [];
  const categorias = (e.categorias || []).map((id) => NOME_CATEGORIA[id] || id).join(', ');
  const especialidades = Array.isArray(e.especialidades) ? e.especialidades.join(', ') : e.especialidades || '';
  return [
    e.verificado ? 'Aprovado' : 'Pendente',
    formatarData(lerData(e.criadoEm)),
    e.nome || '',
    categorias,
    especialidades,
    e.horarioTexto || '',
    e.whatsapp || '',
    e.telefone || '',
    e.instagram ? `@${e.instagram}` : '',
    e.endereco || '',
    temCoordenada ? `${e.lat}, ${e.lng}` : '',
    temCoordenada ? `https://www.google.com/maps?q=${e.lat},${e.lng}` : '',
    fotos.length ? `${fotos.length} foto(s): ${fotos.join(' ')}` : '',
  ].map((v) => String(v));
}

async function main() {
  const sheets = await autenticarGoogleSheets();
  await garantirAba(sheets);

  const snapshot = await db.collection(COLLECTION).where('origem', '==', ORIGEM_SITE).get();
  const cadastros = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    // Mais recentes primeiro; pendentes antes dos aprovados do mesmo dia não importa
    .sort((a, b) => (lerData(b.criadoEm) || 0) - (lerData(a.criadoEm) || 0));

  const linhas = [CABECALHO, ...cadastros.map(montarLinha)];

  // Reescreve a aba inteira (é um espelho do site)
  await sheets.spreadsheets.values.clear({ spreadsheetId: PLANILHA_ID, range: `'${ABA}'!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANILHA_ID,
    range: `'${ABA}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: linhas },
  });

  const pendentes = cadastros.filter((e) => !e.verificado).length;
  console.log(`✅ ${cadastros.length} cadastro(s) feitos pelo site copiados para a aba "${ABA}".`);
  console.log(`   ${cadastros.length - pendentes} aprovado(s), ${pendentes} pendente(s) de aprovação.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao exportar cadastros do site:', erro);
  process.exit(1);
});
