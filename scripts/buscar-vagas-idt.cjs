/**
 * Busca vagas de transporte no site do IDT/SINE e salva no Firestore.
 * Roda automaticamente pelo GitHub Actions, 2x por dia — sem depender
 * de proxies de CORS (que ficam instáveis), porque roda no servidor,
 * não no navegador do usuário.
 *
 * COMO TESTAR LOCALMENTE:
 *   npm install cheerio firebase-admin
 *   node scripts/buscar-vagas-idt.cjs
 * (usa o scripts/serviceAccountKey.json que você já tem)
 */

const cheerio = require('cheerio');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const IDT_URL = 'https://idt.org.br/vagas-disponiveis';

const PALAVRAS_TRANSPORTE = [
  'motorista', 'caminhão', 'caminhao', 'caminhoneiro', 'carreta', 'carreteiro',
  'caçambeiro', 'cacambeiro', 'bitrem', 'basculante', 'guincho', 'munk', 'guindaste',
  'ajudante de motorista', 'ajudante de carga', 'ajudante de descarga',
  'carregador e descarregador',
  'operador de retro', 'retroescavadeira', 'retro-escavadeira',
  'operador de máquina', 'operador de maquina', 'operador de máquinas de construção',
  'operador de trator', 'motofretista', 'motoboy',
  'fiscal de transporte', 'controlador de tráfego', 'controlador de trafego',
  'manobrador', 'manobrista', 'ônibus', 'onibus', 'condutor',
  'operador de balanças rodoviárias', 'operador de balancas rodoviarias',
];

const EXCLUIR_TRANSPORTE = ['estoquista', 'almoxarife'];

function chaveServiceAccount() {
  // No GitHub Actions, a chave vem de um "secret" em base64 (mais seguro).
  // Rodando local no seu PC, usa o arquivo serviceAccountKey.json direto.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(path.join(__dirname, 'serviceAccountKey.json'));
}

function capitalizar(txt) {
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase() : txt;
}

function parseCidade(texto) {
  const raw = texto.split(/[\n\r]/)[0].replace(/[*]/g, '').trim();
  if (raw.includes(':')) {
    const [baseRaw, restoRaw] = raw.split(':');
    const base = baseRaw.trim();
    const bairro = (restoRaw || '').split(/[-–]/)[0].split('/')[0].trim();
    const nome = capitalizar(base) + (bairro ? ' - ' + capitalizar(bairro) : '');
    return { base, nome };
  }
  const clean = raw.split(/[-–\s]+(?:Rua|Av\.|Fone|R\.)/)[0].trim();
  return { base: clean, nome: capitalizar(clean) };
}

async function buscarHtml() {
  const resposta = await fetch(IDT_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (TraV5-Bot; +https://github.com/jfilhoempresarial-ops/tr.alienigenaV5)',
    },
  });
  if (!resposta.ok) {
    throw new Error(`Falha ao acessar o IDT: HTTP ${resposta.status}`);
  }
  return resposta.text();
}

function extrairVagas(html) {
  const $ = cheerio.load(html);
  const itens = [];
  let cidadeAtual = '';
  let cidadeBase = '';
  let enderecoAtual = '';
  let foneAtual = '';
  let emailAtual = '';

  $('table tr').each((_, tr) => {
    const tds = $(tr).find('td');
    if (!tds.length) return;

    const primeiraColuna = $(tds[0]).text().trim();

    if (
      tds.length === 1 &&
      primeiraColuna &&
      !primeiraColuna.includes('OCUPAÇÕES') &&
      !primeiraColuna.includes('Total') &&
      !primeiraColuna.includes('PESSOA COM')
    ) {
      const pc = parseCidade(primeiraColuna);
      if (pc.base.length > 1 && pc.base.length < 60) {
        cidadeBase = pc.base;
        cidadeAtual = pc.nome;

        const endMatch = primeiraColuna.match(/(?:Rua|Av\.|Avenida|Praça|R\.|Al\.)[^\n\r,]*/i);
        enderecoAtual = endMatch ? endMatch[0].trim() : '';

        const foneMatch = primeiraColuna.match(/(?:Fone|Tel|Telefone)[:\s]*\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/i);
        foneAtual = foneMatch ? foneMatch[0].replace(/(?:Fone|Tel|Telefone)[:\s]*/i, '').trim() : '';

        const emailMatch = primeiraColuna.match(/[\w.-]+@[\w.-]+\.[\w]+/);
        emailAtual = emailMatch ? emailMatch[0] : '';
      }
      return;
    }

    if (tds.length >= 2) {
      const cargo = $(tds[0]).text().trim().toLowerCase();
      const qtd = parseInt($(tds[1]).text().trim(), 10) || 0;
      if (!cargo || !qtd || cargo === 'ocupações' || cargo.startsWith('total')) return;

      const relevante =
        PALAVRAS_TRANSPORTE.some((p) => cargo.includes(p)) &&
        !EXCLUIR_TRANSPORTE.some((p) => cargo.includes(p));

      if (relevante && cidadeAtual) {
        itens.push({
          cidade: cidadeAtual,
          cidadeBase,
          cargo: capitalizar(cargo),
          quantidade: qtd,
          endereco: enderecoAtual,
          fone: foneAtual,
          email: emailAtual,
        });
      }
    }
  });

  return itens;
}

async function main() {
  initializeApp({ credential: cert(chaveServiceAccount()) });
  const db = getFirestore();

  console.log('🌐 Buscando vagas no site do IDT/SINE...');
  const html = await buscarHtml();

  if (!html.includes('OCUPAÇÕES') && !html.includes('SOBRAL')) {
    throw new Error('A página do IDT não retornou o conteúdo esperado. O site pode ter mudado de layout.');
  }

  const itens = extrairVagas(html);
  if (!itens.length) {
    throw new Error('Nenhuma vaga de transporte encontrada. Verifique se o layout do site do IDT mudou.');
  }

  await db.collection('vagas').doc('atual').set({
    itens,
    atualizado: new Date().toISOString(),
    fonte: 'IDT/SINE',
  });

  const totalPostos = itens.reduce((s, v) => s + v.quantidade, 0);
  console.log(`✅ ${itens.length} tipos de vaga salvos (${totalPostos} postos no total).`);
}

main().catch((erro) => {
  console.error('❌ Erro:', erro.message);
  process.exit(1);
});
