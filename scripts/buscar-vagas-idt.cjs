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

async function buscarJson() {
  // Tenta 3 vezes, com espera entre as tentativas. Cada tentativa: até 30s.
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resposta = await fetch(IDT_API, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          Referer: 'https://vagas.idt.org.br/',
        },
        signal: AbortSignal.timeout(30000),
      });
      console.log(`↪️  Tentativa ${tentativa}: HTTP ${resposta.status}`);
      if (!resposta.ok) throw new Error(`Falha ao acessar a API do IDT: HTTP ${resposta.status}`);
      return await resposta.json();
    } catch (erro) {
      ultimoErro = erro;
      const causa = erro.cause ? ` | motivo: ${erro.cause.code || ''} ${erro.cause.message || erro.cause}` : '';
      console.warn(`⚠️  Tentativa ${tentativa} falhou: ${erro.message}${causa}`);
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
  console.error('❌ Erro:', erro.message);
  if (erro.cause) console.error('   Motivo:', erro.cause.code || '', erro.cause.message || erro.cause);
  process.exit(1);
});
