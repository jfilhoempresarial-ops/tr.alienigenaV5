/**
 * Monta a aba "Banners" na planilha arquivos_nuvem_tra, com TODOS os banners
 * cadastrados no site (coleção "banners" do Firestore), para controle:
 * empresa, onde aparece, tamanho da imagem, quando entrou, quando a imagem
 * foi trocada, cliques etc.
 *
 * COMO FUNCIONA:
 *   - As colunas automáticas (Status, Empresa, Onde aparece...) são
 *     reescritas a cada rodada — editar AQUI não muda nada no site.
 *   - As colunas de CONTROLE (Início do contrato, Vencimento, Valor,
 *     Observações) são SUAS: pode preencher à vontade que o robô guarda o
 *     que você escreveu (ele reconhece cada banner pela coluna ID).
 *   - "Imagem atualizada em": o robô compara com a rodada anterior; se a
 *     imagem do banner mudou, marca a data de hoje.
 *   - Só entram documentos que têm imagem (os registros de "Empresas
 *     Parceiras" que não têm imagem ficam de fora).
 *
 * Roda pelo GitHub Actions (workflow "Atualizar aba Banners"), 1x por dia.
 * Teste local: node scripts/exportar-banners.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg'; // arquivos_nuvem_tra
const ABA = 'Banners';
const COLLECTION = 'banners';

const COLUNAS_AUTOMATICAS = [
  'ID (não editar)',
  'Status',
  'Empresa',
  'Onde aparece',
  'Tamanho da imagem (px)',
  'Proporção',
  'Entrou no site',
  'Imagem atualizada em',
  'Cliques',
  'Contato (WhatsApp ou link)',
  'Imagem (link)',
];
// Colunas que VOCÊ preenche — o robô nunca apaga o que estiver nelas
const COLUNAS_CONTROLE = ['Início do contrato', 'Vencimento', 'Valor (R$)', 'Observações'];
const CABECALHO = [...COLUNAS_AUTOMATICAS, ...COLUNAS_CONTROLE];

// Nomes amigáveis dos lugares onde o banner aparece (campo "categorias")
const NOME_LUGAR = {
  topo: 'Home – carrossel do topo',
  pertodevoce: 'Home – Perto de você',
  'home-vertical': 'Home – Marcas',
  eventos: 'Eventos',
  vagas: 'Vagas',
  fretes: 'Fretes',
  mecanico: 'Categoria Mecânicos',
  posto: 'Categoria Posto/Conveniência',
  borracharia: 'Categoria Borracharia',
  eletrica: 'Categoria Elétrica',
  guincho: 'Categoria Guincho/Socorro',
  lavajato: 'Categoria Lava-Jato',
  pontoapoio: 'Categoria PPDs ANTT',
  autopecas: 'Categoria Auto Peças',
  tacografo: 'Categoria Tacógrafo',
  molas: 'Categoria Molas e Suspensão',
  funilaria: 'Categoria Funilaria e Retífica',
  vidros: 'Categoria Vidros e Para-brisa',
  restaurante: 'Categoria Restaurante e Hospedagem',
  financiamento: 'Categoria Outros Serviços',
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

function lerData(valor) {
  if (!valor) return null;
  if (typeof valor.toDate === 'function') return valor.toDate();
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatarData(d) {
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Fortaleza' });
}

// ---------------------------------------------------------------------------
// Tamanho da imagem: lê só o "cabeçalho" do arquivo (PNG, JPG, GIF, WEBP)
// ---------------------------------------------------------------------------
function medirImagem(buf) {
  if (buf.length < 30) return null;
  // PNG
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { largura: buf.readUInt32BE(16), altura: buf.readUInt32BE(20) };
  }
  // GIF
  if (buf.toString('ascii', 0, 3) === 'GIF') {
    return { largura: buf.readUInt16LE(6), altura: buf.readUInt16LE(8) };
  }
  // WEBP
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const tipo = buf.toString('ascii', 12, 16);
    if (tipo === 'VP8 ') return { largura: buf.readUInt16LE(26) & 0x3fff, altura: buf.readUInt16LE(28) & 0x3fff };
    if (tipo === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { largura: (b & 0x3fff) + 1, altura: ((b >> 14) & 0x3fff) + 1 };
    }
    if (tipo === 'VP8X') return { largura: buf.readUIntLE(24, 3) + 1, altura: buf.readUIntLE(27, 3) + 1 };
  }
  // JPEG: procura o bloco SOF, que guarda altura e largura
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marcador = buf[i + 1];
      const tamanho = buf.readUInt16BE(i + 2);
      if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
        return { altura: buf.readUInt16BE(i + 5), largura: buf.readUInt16BE(i + 7) };
      }
      i += 2 + tamanho;
    }
  }
  return null;
}

async function tamanhoDaImagem(url) {
  if (!url) return null;
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!resposta.ok) return null;
    return medirImagem(Buffer.from(await resposta.arrayBuffer()));
  } catch {
    return null;
  }
}

function proporcao({ largura, altura }) {
  if (!largura || !altura) return '';
  return `${(largura / altura).toFixed(1).replace('.', ',')} : 1`;
}

/** Lê o que já está na aba: colunas de controle e a imagem de cada banner (por ID). */
async function lerAbaAtual(sheets) {
  const resposta = await sheets.spreadsheets.values.get({ spreadsheetId: PLANILHA_ID, range: `'${ABA}'!A:Z` });
  const linhas = resposta.data.values || [];
  const porId = new Map();
  if (linhas.length < 2) return porId;

  const cabecalho = linhas[0];
  const indice = (nome) => cabecalho.indexOf(nome);
  for (const linha of linhas.slice(1)) {
    const id = linha[0];
    if (!id) continue;
    porId.set(id, {
      imagem: linha[indice('Imagem (link)')] || '',
      imagemAtualizadaEm: linha[indice('Imagem atualizada em')] || '',
      controle: COLUNAS_CONTROLE.map((nome) => (indice(nome) >= 0 ? linha[indice(nome)] || '' : '')),
    });
  }
  return porId;
}

async function main() {
  const sheets = await autenticarGoogleSheets();
  await garantirAba(sheets);
  const anteriores = await lerAbaAtual(sheets);

  const snapshot = await db.collection(COLLECTION).get();
  const banners = snapshot.docs
    .map((doc) => ({ id: doc.id, criadoNoFirestore: doc.createTime?.toDate(), ...doc.data() }))
    .filter((b) => b.imagemUrl);
  console.log(`📦 ${banners.length} banners com imagem (de ${snapshot.size} documentos na coleção).`);

  const hoje = formatarData(new Date());
  const linhas = [];
  for (const b of banners) {
    const tamanho = await tamanhoDaImagem(b.imagemUrl);
    const antes = anteriores.get(b.id);
    const entrou = formatarData(lerData(b.criadoEm) || b.criadoNoFirestore);

    let imagemAtualizadaEm = entrou;
    if (antes) {
      imagemAtualizadaEm = antes.imagem && antes.imagem !== b.imagemUrl ? hoje : antes.imagemAtualizadaEm || entrou;
    }

    const lugares = (b.categorias || []).map((tag) => NOME_LUGAR[tag] || tag).join(', ');
    linhas.push({
      ativo: b.ativo === true,
      lugares,
      empresa: b.empresaNome || '',
      valores: [
        b.id,
        b.ativo === true ? 'Ativo' : 'Inativo',
        b.empresaNome || '',
        lugares,
        tamanho ? `${tamanho.largura} x ${tamanho.altura}` : 'não consegui medir',
        tamanho ? proporcao(tamanho) : '',
        entrou,
        imagemAtualizadaEm,
        String(b.cliques || 0),
        b.whatsapp ? `WhatsApp ${b.whatsapp}` : b.link || '',
        b.imagemUrl,
        ...(antes ? antes.controle : COLUNAS_CONTROLE.map(() => '')),
      ],
    });
  }

  // Ativos primeiro, depois por lugar e por empresa
  linhas.sort(
    (a, b) =>
      Number(b.ativo) - Number(a.ativo) || a.lugares.localeCompare(b.lugares) || a.empresa.localeCompare(b.empresa)
  );

  await sheets.spreadsheets.values.clear({ spreadsheetId: PLANILHA_ID, range: `'${ABA}'!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId: PLANILHA_ID,
    range: `'${ABA}'!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [CABECALHO, ...linhas.map((l) => l.valores)] },
  });

  const ativos = linhas.filter((l) => l.ativo).length;
  console.log(`✅ Aba "${ABA}" atualizada: ${linhas.length} banners (${ativos} ativos, ${linhas.length - ativos} inativos).`);
}

main().catch((erro) => {
  console.error('❌ Erro ao montar a aba Banners:', erro);
  process.exit(1);
});
