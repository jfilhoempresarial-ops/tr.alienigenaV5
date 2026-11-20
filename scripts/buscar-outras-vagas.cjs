/**
 * OUTRAS VAGAS (aba "Outras vagas" da página de Vagas)
 *
 * Junta duas fontes, sem misturar com as vagas do SINE:
 *  1. JOOBLE: buscador que reúne vagas de vários sites de emprego e de
 *     páginas de empresas. Usa a API oficial (secret JOOBLE_API_KEY).
 *     Busca no Ceará e fica só com cargos de Transporte e Logística
 *     (mesmo filtro do SINE: scripts/filtro-transporte.cjs).
 *  2. VAGAS INDICADAS: a aba "Vagas Indicadas" da planilha arquivos_nuvem_tra,
 *     onde o Júlio cola vagas vistas no Instagram ou no site das empresas.
 *     Colunas: Cargo | Cidade | Empresa | Link da vaga | Contato | Válida até
 *     - "Válida até" vencida: a vaga sai do site.
 *     - "Válida até" em branco: a vaga fica 30 dias, contados de quando o
 *       robô viu ela pela primeira vez.
 *     - Se a aba não existir, o robô cria, já com o cabeçalho.
 *
 * Grava em outras_vagas/atual (público) e outras_vagas/controle (datas
 * internas das indicadas). Roda 1x por dia: .github/workflows/atualizar-outras-vagas.yml
 *
 * A Adzuna também está preparada, mas DESLIGADA: só entra se os secrets
 * ADZUNA_APP_ID e ADZUNA_APP_KEY existirem (ela é paga).
 */

const path = require('path');
const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { ehVagaDeTransporte, normalizarTexto: normalizar } = require('./filtro-transporte.cjs');

const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg'; // arquivos_nuvem_tra
const ABA_INDICADAS = 'Vagas Indicadas';
const CABECALHO_INDICADAS = ['Cargo', 'Cidade', 'Empresa', 'Link da vaga', 'Contato', 'Válida até'];
const DIAS_PADRAO_INDICADA = 30;
const DIAS_MAX_JOOBLE = 30; // vaga do Jooble mais velha que isso não entra

// O que procurar no Jooble (uma busca por termo, no Ceará inteiro).
// O filtro de transporte ainda passa em cada resultado depois.
const BUSCAS_JOOBLE = [
  'motorista',
  'ajudante de carga e descarga',
  'estoquista',
  'auxiliar de logística',
  'conferente',
  'operador de empilhadeira',
  'mecânico diesel',
  'operador de máquinas pesadas',
];
const PAGINAS_POR_BUSCA = 3;
const LOCAL_BUSCA = 'Ceará';

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------
function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8'));
  }
  return require(path.join(__dirname, 'serviceAccountKey.json'));
}

function limparHtml(txt) {
  return String(txt || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

const MINUSCULAS = ['de', 'da', 'do', 'das', 'dos', 'e'];
function nomeProprio(txt) {
  return String(txt || '')
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((p, i) => (i > 0 && MINUSCULAS.includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

/** "Sobral, CE" / "Sobral - CE" / "Sobral" → "Sobral". Devolve '' se for fora do Ceará. */
function cidadeDoCeara(local) {
  const bruto = limparHtml(local);
  if (!bruto) return '';
  const n = normalizar(bruto);
  const partes = bruto.split(/\s*[,\-–]\s*/).filter(Boolean);
  const ultimo = normalizar(partes[partes.length - 1] || '');
  const temEstado = partes.length > 1;
  const ehCeara = ultimo === 'ce' || ultimo === 'ceara' || n.includes('ceara');
  if (temEstado && !ehCeara) return ''; // outro estado
  const cidade = partes[0];
  if (!cidade || ['ceara', 'ce', 'brasil'].includes(normalizar(cidade))) return 'Ceará (várias cidades)';
  return nomeProprio(cidade);
}

// Nome amigável do site de origem (o Jooble manda o domínio, ex.: "catho.com.br")
const SITES_CONHECIDOS = [
  ['catho', 'Catho'], ['infojobs', 'InfoJobs'], ['indeed', 'Indeed'], ['gupy', 'Gupy'],
  ['linkedin', 'LinkedIn'], ['vagas.com', 'Vagas.com'], ['trabalhabrasil', 'Trabalha Brasil'],
  ['empregos.com', 'Empregos.com.br'], ['bne.com', 'BNE'], ['solides', 'Sólides'],
  ['glassdoor', 'Glassdoor'], ['emprega', 'Emprega Brasil'], ['olx', 'OLX'], ['sine', 'SINE'],
];

function nomeDoSite(source) {
  const s = limparHtml(source).toLowerCase();
  if (!s) return '';
  const conhecido = SITES_CONHECIDOS.find(([chave]) => s.includes(chave));
  if (conhecido) return conhecido[1];
  return s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
}

// Empresa "genérica" que o site de vagas usa quando não quer dizer o nome
const EMPRESAS_GENERICAS = ['empresa', 'empresa confidencial', 'confidencial', 'sigiloso', 'sigilosa', 'nao informado', 'nao informada', 'empresa sigilosa'];

function limparEmpresa(nome) {
  const e = limparHtml(nome);
  return EMPRESAS_GENERICAS.includes(normalizar(e)) ? '' : e;
}

/**
 * Arruma o título que vem do Jooble e, se o título disser a cidade, usa ela:
 *  "MOTORISTA - CE"                      → "Motorista"
 *  "Ajudante de Motorista - Tianguá/CE"  → "Ajudante de Motorista" (cidade: Tianguá)
 */
function arrumarTitulo(tituloBruto) {
  let titulo = limparHtml(tituloBruto);
  let cidade = '';
  const m = titulo.match(/\s*[-–|(]\s*([A-Za-zÀ-ÿ' ]{3,})\s*[\/-]\s*CE\s*\)?\s*$/i);
  if (m) {
    cidade = nomeProprio(m[1].trim());
    titulo = titulo.slice(0, m.index);
  } else {
    titulo = titulo.replace(/\s*[-–|(]\s*(CE|Ceará|Ceara)\s*\)?\s*$/i, '');
  }
  titulo = titulo.trim();
  if (titulo && titulo === titulo.toUpperCase()) {
    titulo = titulo.charAt(0) + titulo.slice(1).toLowerCase(); // "MOTORISTA" → "Motorista"
  }
  return { titulo, cidade };
}

/**
 * Procura um telefone/WhatsApp no resumo da vaga (o Jooble manda só um trecho
 * da descrição, então nem sempre tem). Devolve só dígitos com DDD, ou ''.
 */
function acharTelefone(texto) {
  const t = limparHtml(texto);
  const m = t.match(/(?:\+?55\s?)?\(?\b([1-9]{2})\)?[\s.-]?(9?\d{4})[\s.-]?(\d{4})\b/);
  if (!m) return '';
  const numero = `${m[1]}${m[2]}${m[3]}`;
  return numero.length === 10 || numero.length === 11 ? numero : '';
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function somarDias(isoData, dias) {
  const d = new Date(`${isoData}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "31/12/2026", "31/12/26", "2026-12-31" ou número de data da planilha → "2026-12-31" */
function lerData(valor) {
  if (typeof valor === 'number' && valor > 0) {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86400000).toISOString().slice(0, 10);
  }
  const s = String(valor || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// 1. JOOBLE
// ---------------------------------------------------------------------------
async function postJson(url, corpo) {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  if (!resp.ok) {
    const erro = new Error(`HTTP ${resp.status}`);
    erro.status = resp.status;
    throw erro;
  }
  return resp.json();
}

async function buscarJooble() {
  const chave = process.env.JOOBLE_API_KEY;
  if (!chave) {
    console.log('ℹ️  Jooble desligado (falta o secret JOOBLE_API_KEY).');
    return { itens: [], ok: false };
  }

  // A chave é do Jooble Brasil; se o endereço brasileiro recusar, tenta o geral.
  const enderecos = [`https://br.jooble.org/api/${chave}`, `https://jooble.org/api/${chave}`];
  let endereco = null;

  const brutos = [];
  for (const termo of BUSCAS_JOOBLE) {
    for (let pagina = 1; pagina <= PAGINAS_POR_BUSCA; pagina++) {
      let json = null;
      const tentar = endereco ? [endereco] : enderecos;
      for (const url of tentar) {
        try {
          json = await postJson(url, { keywords: termo, location: LOCAL_BUSCA, page: String(pagina) });
          endereco = url;
          break;
        } catch (erro) {
          if (url === tentar[tentar.length - 1]) {
            console.log(`   • Jooble "${termo}" p.${pagina}: falhou (${erro.message})`);
          }
        }
      }
      if (!json) break;
      const jobs = Array.isArray(json.jobs) ? json.jobs : [];
      if (pagina === 1) console.log(`   • Jooble "${termo}": ${json.totalCount ?? jobs.length} no total`);
      brutos.push(...jobs);
      if (jobs.length < 15) break; // acabou
    }
  }

  if (!endereco) return { itens: [], ok: false };

  const limite = somarDias(hojeISO(), -DIAS_MAX_JOOBLE);
  const itens = [];
  for (const j of brutos) {
    const { titulo: cargo, cidade: cidadeDoTitulo } = arrumarTitulo(j.title);
    if (!cargo || !ehVagaDeTransporte(cargo)) continue;
    const cidadeDoLocal = cidadeDoCeara(j.location);
    if (!cidadeDoLocal && !cidadeDoTitulo) continue;
    const cidade = cidadeDoTitulo || cidadeDoLocal;
    const publicado = String(j.updated || '').slice(0, 10);
    if (publicado && publicado < limite) continue;
    if (!j.link) continue;
    itens.push({
      cargo,
      cidade,
      cidadeBase: cidade.toUpperCase(),
      empresa: limparEmpresa(j.company),
      link: j.link,
      contato: acharTelefone(`${j.snippet || ''} ${j.title || ''}`),
      fonte: 'jooble',
      origem: nomeDoSite(j.source),
      publicado: publicado || '',
      salario: limparHtml(j.salary),
    });
  }
  return { itens, ok: true };
}

// ---------------------------------------------------------------------------
// (Desligada) ADZUNA — só roda se os secrets existirem
// ---------------------------------------------------------------------------
async function buscarAdzuna() {
  const id = process.env.ADZUNA_APP_ID;
  const chave = process.env.ADZUNA_APP_KEY;
  if (!id || !chave) return { itens: [], ok: false };

  const itens = [];
  for (const termo of BUSCAS_JOOBLE) {
    const url =
      `https://api.adzuna.com/v1/api/jobs/br/search/1?app_id=${encodeURIComponent(id)}` +
      `&app_key=${encodeURIComponent(chave)}&results_per_page=50&max_days_old=${DIAS_MAX_JOOBLE}` +
      `&what=${encodeURIComponent(termo)}&where=${encodeURIComponent(LOCAL_BUSCA)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      for (const r of json.results || []) {
        const cargo = arrumarTitulo(r.title).titulo;
        if (!cargo || !ehVagaDeTransporte(cargo)) continue;
        const area = (r.location && r.location.area) || [];
        const cidade = area.length ? nomeProprio(area[area.length - 1]) : cidadeDoCeara(r.location && r.location.display_name);
        if (!cidade) continue;
        itens.push({
          cargo,
          cidade,
          cidadeBase: cidade.toUpperCase(),
          empresa: limparEmpresa(r.company && r.company.display_name),
          link: r.redirect_url,
          contato: '',
          fonte: 'adzuna',
          publicado: String(r.created || '').slice(0, 10),
          salario: '',
        });
      }
    } catch (erro) {
      console.log(`   • Adzuna "${termo}": falhou (${erro.message})`);
    }
  }
  return { itens, ok: true };
}

// ---------------------------------------------------------------------------
// 2. VAGAS INDICADAS (planilha)
// ---------------------------------------------------------------------------
async function lerIndicadas(credencial, controleAnterior) {
  const auth = new google.auth.JWT({
    email: credencial.client_email,
    key: credencial.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  const sheets = google.sheets({ version: 'v4', auth });

  // Cria a aba, com cabeçalho, se ainda não existir
  const planilha = await sheets.spreadsheets.get({ spreadsheetId: PLANILHA_ID });
  const existe = (planilha.data.sheets || []).some((s) => s.properties.title === ABA_INDICADAS);
  if (!existe) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: PLANILHA_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: ABA_INDICADAS } } }] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: PLANILHA_ID,
      range: `'${ABA_INDICADAS}'!A1:F1`,
      valueInputOption: 'RAW',
      requestBody: { values: [CABECALHO_INDICADAS] },
    });
    console.log(`📄 Aba "${ABA_INDICADAS}" criada na planilha (com cabeçalho). Ainda vazia.`);
    return { itens: [], controle: {} };
  }

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILHA_ID,
    range: `'${ABA_INDICADAS}'!A2:F`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const linhas = resp.data.values || [];

  const hoje = hojeISO();
  const controle = {};
  const itens = [];
  let vencidas = 0;

  for (const linha of linhas) {
    const [cargo, cidade, empresa, link, contato, validaAte] = linha.map((c) => (c == null ? '' : c));
    if (!String(cargo).trim() || !String(cidade).trim()) continue;

    const chave = normalizar(`${cargo}|${cidade}|${empresa}|${link}`);
    const primeiraVez = controleAnterior[chave] || hoje;
    controle[chave] = primeiraVez;

    const vence = lerData(validaAte) || somarDias(primeiraVez, DIAS_PADRAO_INDICADA);
    if (vence < hoje) {
      vencidas++;
      continue;
    }

    const nomeCidade = nomeProprio(String(cidade).trim());
    const linkLimpo = String(link).trim();
    itens.push({
      cargo: String(cargo).trim(),
      cidade: nomeCidade,
      cidadeBase: nomeCidade.toUpperCase(),
      empresa: String(empresa).trim(),
      link: /^https?:\/\//i.test(linkLimpo) ? linkLimpo : '',
      contato: String(contato).trim(),
      fonte: 'indicada',
      publicado: primeiraVez,
      validaAte: vence,
      salario: '',
    });
  }

  console.log(`📝 Vagas Indicadas: ${itens.length} no ar · ${vencidas} vencida(s) fora do site.`);
  return { itens, controle };
}

// ---------------------------------------------------------------------------
// Junta tudo
// ---------------------------------------------------------------------------
function semRepetidas(lista) {
  const vistos = new Set();
  const saida = [];
  for (const v of lista) {
    const chave = v.link || normalizar(`${v.cargo}|${v.cidade}|${v.empresa}`);
    const chave2 = normalizar(`${v.cargo}|${v.cidade}|${v.empresa}`);
    if (vistos.has(chave) || vistos.has(chave2)) continue;
    vistos.add(chave);
    vistos.add(chave2);
    saida.push(v);
  }
  return saida;
}

async function main() {
  const credencial = carregarCredencial();
  initializeApp({ credential: cert(credencial) });
  const db = getFirestore();

  const controleSnap = await db.collection('outras_vagas').doc('controle').get();
  const controleAnterior = (controleSnap.exists && controleSnap.data().indicadas) || {};

  // Vagas que motoristas avisaram como encerradas e o admin confirmou: não voltam mais
  const avisosSnap = await db.collection('avisos_vagas').where('confirmado', '==', true).get();
  const encerradas = new Set(avisosSnap.docs.map((d) => d.data().link).filter(Boolean));
  if (encerradas.size) console.log(`🚩 ${encerradas.size} vaga(s) tirada(s) do site por aviso de encerrada.`);

  console.log('🔎 Buscando vagas no Jooble (Ceará)...');
  const jooble = await buscarJooble();
  const adzuna = await buscarAdzuna();

  let indicadas = { itens: [], controle: controleAnterior };
  let indicadasOk = true;
  try {
    indicadas = await lerIndicadas(credencial, controleAnterior);
  } catch (erro) {
    indicadasOk = false;
    console.log(`⚠️  Não deu para ler a aba "${ABA_INDICADAS}": ${erro.message}`);
  }

  if (!jooble.ok && !adzuna.ok && !indicadasOk) {
    throw new Error('Nenhuma fonte respondeu. Nada foi alterado no site.');
  }

  // Indicadas primeiro: se a mesma vaga vier também do Jooble, fica a sua.
  const itens = semRepetidas([...indicadas.itens, ...jooble.itens, ...adzuna.itens]).filter(
    (v) => !v.link || !encerradas.has(v.link)
  );

  const porFonte = itens.reduce((m, v) => ((m[v.fonte] = (m[v.fonte] || 0) + 1), m), {});
  const porCidade = itens.reduce((m, v) => ((m[v.cidade] = (m[v.cidade] || 0) + 1), m), {});

  await db.collection('outras_vagas').doc('atual').set({
    itens,
    atualizado: new Date().toISOString(),
    porFonte,
  });
  await db.collection('outras_vagas').doc('controle').set({ indicadas: indicadas.controle });

  const comContato = itens.filter((v) => v.contato).length;
  console.log(`✅ ${itens.length} vagas publicadas na aba "Outras vagas":`, porFonte, `· ${comContato} com telefone/WhatsApp`);
  Object.entries(porCidade)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cidade, n]) => console.log(`     - ${cidade}: ${n}`));
}

main().catch((erro) => {
  console.error('❌', erro.message || erro);
  process.exit(1);
});
