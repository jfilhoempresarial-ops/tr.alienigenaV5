/**
 * Busca vagas de transporte do IDT/SINE e salva no Firestore.
 * Roda automaticamente pelo GitHub Actions, 2x por dia.
 *
 * O IDT trocou o site em set/2026: a página antiga com tabela
 * (idt.org.br/vagas-disponiveis) agora redireciona para vagas.idt.org.br,
 * que carrega tudo de uma API em JSON. Lemos direto dessa API — os dados já
 * vêm separados (município, unidade, tipo de vaga), sem precisar "adivinhar"
 * pela tabela.
 *
 * PRIVACIDADE: a API também traz nome da empresa, nomes e celulares pessoais
 * de funcionários do IDT. NADA disso é salvo — só o telefone da unidade.
 *
 * COMO TESTAR LOCALMENTE:
 *   npm install firebase-admin
 *   node scripts/buscar-vagas-idt.cjs
 * (usa o scripts/serviceAccountKey.json que você já tem)
 */

const path = require('path');
const https = require('https');
const http = require('http');
const tls = require('tls');
const { X509Certificate } = require('crypto');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const IDT_API = 'https://vagas.idt.org.br/api/vagas';

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

function normalizar(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalizar(txt) {
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase() : txt;
}

// "Fortaleza" -> "Fortaleza"; "JUAZEIRO DO NORTE" -> "Juazeiro do Norte"
function nomeProprio(txt) {
  const minusculas = ['de', 'da', 'do', 'das', 'dos', 'e'];
  return String(txt || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((p, i) => (i > 0 && minusculas.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

function tipoDaVaga(pcd) {
  const t = normalizar(pcd);
  if (t.includes('exclusiv')) return 'Exclusiva PcD';
  if (t.includes('inclusiv')) return 'Inclusiva';
  return 'Regular';
}

// Pega o primeiro campo que exista, entre vários nomes possíveis
function campo(obj, ...nomes) {
  for (const n of nomes) {
    if (obj[n] !== undefined && obj[n] !== null && String(obj[n]).trim() !== '') return obj[n];
  }
  return '';
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Referer: 'https://vagas.idt.org.br/',
};

// ---------------------------------------------------------------------------
// CERTIFICADO DO IDT
// O servidor do IDT manda o certificado SSL incompleto (falta o certificado
// "intermediário"). O navegador baixa a peça que falta sozinho; o Node não,
// e dá o erro UNABLE_TO_VERIFY_LEAF_SIGNATURE.
// Solução segura: baixamos o intermediário do endereço oficial que vem
// dentro do próprio certificado (campo "CA Issuers") e completamos a cadeia.
// A verificação de segurança continua LIGADA — não desligamos nada.
// ---------------------------------------------------------------------------

function baixarBinario(url) {
  const mod = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(url, { timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(baixarBinario(new URL(res.headers.location, url).toString()));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} ao baixar ${url}`));
      }
      const partes = [];
      res.on('data', (c) => partes.push(c));
      res.on('end', () => resolve(Buffer.concat(partes)));
    });
    req.on('timeout', () => req.destroy(new Error(`Tempo esgotado ao baixar ${url}`)));
    req.on('error', reject);
  });
}

function urlsDoEmissor(infoAccess) {
  // infoAccess vem como texto: "CA Issuers - URI:http://...\nOCSP - URI:..."
  // ou como objeto { 'CA Issuers - URI': [...] }, dependendo da versão do Node
  if (!infoAccess) return [];
  if (typeof infoAccess === 'object') return infoAccess['CA Issuers - URI'] || [];
  return [...String(infoAccess).matchAll(/CA Issuers - URI:(\S+)/g)].map((m) => m[1]);
}

function lerCertificado(buf) {
  const txt = buf.toString('latin1');
  if (txt.includes('-----BEGIN CERTIFICATE-----')) return new X509Certificate(txt);
  return new X509Certificate(buf); // formato DER (binário), o mais comum
}

function certificadoDoServidor(host) {
  return new Promise((resolve, reject) => {
    // Conexão só para LER o certificado (nenhum dado é enviado/recebido)
    const socket = tls.connect(
      { host, port: 443, servername: host, rejectUnauthorized: false, timeout: 20000 },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.raw) return reject(new Error('Não foi possível ler o certificado do IDT'));
        resolve(new X509Certificate(cert.raw));
      }
    );
    socket.on('timeout', () => socket.destroy(new Error('Tempo esgotado lendo o certificado do IDT')));
    socket.on('error', reject);
  });
}

async function intermediariosFaltando(host) {
  const pems = [];
  let atual = await certificadoDoServidor(host);
  // Sobe a cadeia até 3 níveis (normalmente só 1 falta)
  for (let nivel = 0; nivel < 3; nivel++) {
    const urls = urlsDoEmissor(atual.infoAccess);
    if (!urls.length) break;
    const emissor = lerCertificado(await baixarBinario(urls[0]));
    pems.push(emissor.toString());
    console.log(`🔐 Certificado intermediário baixado: ${emissor.subject.split('\n').find((l) => l.startsWith('CN=')) || urls[0]}`);
    if (emissor.subject === emissor.issuer) break; // chegou na raiz
    atual = emissor;
  }
  if (!pems.length) throw new Error('O certificado do IDT não informa onde baixar o intermediário');
  return pems;
}

function pedirJson(url, ca) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS, timeout: 30000, ...(ca ? { ca } : {}) }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`Falha ao acessar a API do IDT: HTTP ${res.statusCode}`));
      }
      let corpo = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (corpo += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(corpo));
        } catch {
          reject(new Error('A API do IDT não devolveu um JSON válido'));
        }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Tempo esgotado acessando a API do IDT')));
    req.on('error', reject);
  });
}

async function buscarJson() {
  const host = new URL(IDT_API).hostname;
  let ca = null; // null = usa só os certificados padrão do sistema
  let ultimoErro;

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const json = await pedirJson(IDT_API, ca);
      console.log(`↪️  Tentativa ${tentativa}: OK`);
      return json;
    } catch (erro) {
      ultimoErro = erro;
      console.warn(`⚠️  Tentativa ${tentativa} falhou: ${erro.code || ''} ${erro.message}`);

      const erroDeCadeia = ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'].includes(erro.code);
      if (erroDeCadeia && !ca) {
        console.log('🔧 Certificado do IDT incompleto — completando a cadeia...');
        try {
          ca = [...tls.rootCertificates, ...(await intermediariosFaltando(host))];
          tentativa--; // não conta como tentativa perdida
          continue;
        } catch (e) {
          console.warn(`⚠️  Não deu para completar o certificado: ${e.message}`);
        }
      }
      if (tentativa < 3) await new Promise((r) => setTimeout(r, tentativa * 10000));
    }
  }
  throw ultimoErro;
}

// A API pode devolver a lista direto ou dentro de um objeto ({ data: [...] })
function extrairLista(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    for (const chave of ['data', 'vagas', 'items', 'itens', 'results', 'resultado']) {
      if (Array.isArray(json[chave])) return json[chave];
    }
    const primeiraLista = Object.values(json).find(Array.isArray);
    if (primeiraLista) return primeiraLista;
  }
  return [];
}

function montarItens(lista) {
  const itens = [];

  for (const v of lista) {
    const cargoOriginal = String(campo(v, 'ocupacao', 'cargo')).trim();
    const cargo = cargoOriginal.toLowerCase();
    const qtd = parseInt(campo(v, 'qtde_vagas', 'quantidade', 'qtd'), 10) || 0;
    const municipio = String(campo(v, 'municipio', 'cidade')).trim();
    if (!cargo || !qtd || !municipio) continue;

    const relevante =
      PALAVRAS_TRANSPORTE.some((p) => cargo.includes(p)) &&
      !EXCLUIR_TRANSPORTE.some((p) => cargo.includes(p));
    if (!relevante) continue;

    const unidade = String(campo(v, 'unidade')).trim();
    const nomeMunicipio = nomeProprio(municipio);
    // Em cidade com mais de um posto (Fortaleza), mostra também a unidade.
    // Se o nome da unidade já contém a cidade ("U.A. Sobral"), não repete.
    const cidade =
      unidade && !normalizar(unidade).includes(normalizar(municipio))
        ? `${nomeMunicipio} - ${unidade}`
        : nomeMunicipio;

    // Endereço: usa o campo que existir com "endereco" no nome
    const chaveEndereco = Object.keys(v).find((k) => normalizar(k).includes('endereco'));

    const lat = parseFloat(v.latitude);
    const lng = parseFloat(v.longitude);

    itens.push({
      cidade,
      cidadeBase: municipio.toUpperCase(),
      cargo: capitalizar(cargoOriginal),
      quantidade: qtd,
      tipo: tipoDaVaga(v.pcd),
      unidade,
      endereco: chaveEndereco ? String(v[chaveEndereco] || '').trim() : '',
      // Só o telefone da UNIDADE (público). Nunca celular/nome de funcionário.
      fone: String(campo(v, 'telefone_unidade', 'telefone')).trim(),
      email: String(campo(v, 'email_unidade')).trim(),
      ...(Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : {}),
    });
  }

  return itens;
}

async function main() {
  initializeApp({ credential: cert(chaveServiceAccount()) });
  const db = getFirestore();

  console.log('🌐 Buscando vagas na API do IDT/SINE...');
  const json = await buscarJson();
  const lista = extrairLista(json);
  console.log(`📦 ${lista.length} vagas recebidas no total (todas as áreas).`);

  if (!lista.length || !lista.some((v) => v && v.ocupacao !== undefined)) {
    throw new Error('A API do IDT não retornou o formato esperado (campo "ocupacao"). Nada foi salvo.');
  }

  const itens = montarItens(lista);
  if (!itens.length) {
    throw new Error('Nenhuma vaga de transporte encontrada. Nada foi salvo.');
  }

  await db.collection('vagas').doc('atual').set({
    itens,
    atualizado: new Date().toISOString(),
    fonte: 'IDT/SINE',
  });

  const totalPostos = itens.reduce((s, v) => s + v.quantidade, 0);
  const cidades = new Set(itens.map((v) => v.cidadeBase)).size;
  console.log(`✅ ${itens.length} tipos de vaga salvos (${totalPostos} postos em ${cidades} cidades).`);
}

main().catch((erro) => {
  console.error('❌ Erro:', erro.code || '', erro.message);
  process.exit(1);
});
