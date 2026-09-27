/**
 * ROBÔ DE EVENTOS DO UNIVERSO DO CAMINHÃO (roda 1x por semana)
 *
 * COMO ACHA OS EVENTOS: pede para o Claude (IA da Anthropic, pela API, com
 * busca na internet) pesquisar feiras, encontros, festas de caminhoneiros,
 * gincanas, corridas de caminhão e palestras no Brasil inteiro, nos
 * próximos 12 meses — do mesmo jeito que foi feito na pesquisa manual.
 * (Antes o robô lia o Sympla e o Eventbrite direto, mas o Sympla monta a
 * lista só no navegador e o Eventbrite bloqueia robôs — erro 405.)
 *
 * Depois o robô confere cada evento, tenta pegar a imagem na página
 * oficial e ACRESCENTA no scripts/eventos.json. O workflow então roda o
 * sincronizar-eventos.cjs, que publica no site.
 *
 * PRECISA: segredo ANTHROPIC_API_KEY no GitHub (Settings → Secrets and
 * variables → Actions). Sem ele, o robô só avisa no log e não mexe em nada.
 *
 * REGRAS DE SEGURANÇA:
 *   - Nunca mexe nos eventos que VOCÊ cadastrou no eventos.json. Os eventos
 *     do robô ficam marcados com "origem": "robo-eventos".
 *   - Só entra evento presencial, com data de hoje até 12 meses, cidade,
 *     link de fonte e ligado a caminhão/caminhoneiro/transporte.
 *   - Não repete evento que já está no arquivo (mesmo nome e data).
 *   - No máximo MAX_NOVOS_POR_RODADA eventos novos por semana.
 *   - Eventos do robô que já passaram há mais de 30 dias saem do arquivo.
 *
 * NÃO QUER UM EVENTO QUE O ROBÔ COLOCOU? Apague o bloco dele no
 * scripts/eventos.json e cole o link dele em "ignorar" no
 * scripts/fontes-eventos.json — assim ele não volta.
 *
 * Teste local: ANTHROPIC_API_KEY=... node scripts/buscar-eventos-caminhao.cjs
 */

const fs = require('fs');
const path = require('path');

const CAMINHO_EVENTOS = path.join(__dirname, 'eventos.json');
const CAMINHO_FONTES = path.join(__dirname, 'fontes-eventos.json');
const ORIGEM = 'robo-eventos';
const MAX_NOVOS_POR_RODADA = 8;

// Pelo menos um destes precisa aparecer no NOME do evento...
const PALAVRAS_NO_TITULO = [
  'caminh', 'truck', 'carreta', 'rodoviar', 'transportador', 'transporte de carga',
  'frota', 'cegonh', 'bitrem', 'fenatran', 'transposul', 'intermodal', 'motorista profissional',
];
// ...ou a descrição precisa falar claramente de caminhão/caminhoneiro.
const PALAVRAS_NA_DESCRICAO = ['caminhoneir', 'caminhao', 'caminhoes', 'truck', 'transporte rodoviario de cargas'];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Accept: 'text/html,application/xhtml+xml',
};

const UF_POR_NOME = {
  acre: 'AC', alagoas: 'AL', amapa: 'AP', amazonas: 'AM', bahia: 'BA', ceara: 'CE',
  'distrito federal': 'DF', 'espirito santo': 'ES', goias: 'GO', maranhao: 'MA',
  'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG', para: 'PA',
  paraiba: 'PB', parana: 'PR', pernambuco: 'PE', piaui: 'PI', 'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN', 'rio grande do sul': 'RS', rondonia: 'RO', roraima: 'RR',
  'santa catarina': 'SC', 'sao paulo': 'SP', sergipe: 'SE', tocantins: 'TO',
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------
function normalizar(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tira HTML e símbolos perigosos: o texto vai direto para a página de Eventos. */
function limparTexto(txt, max = 220) {
  const t = String(txt || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[<>"`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

function hojeISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Fortaleza' }); // AAAA-MM-DD
}

function somarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dataBR(iso) {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

function ufDe(regiao) {
  const r = normalizar(regiao);
  if (/^[a-z]{2}$/.test(r)) return r.toUpperCase();
  return UF_POR_NOME[r] || '';
}

async function baixar(url) {
  const resposta = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25000) });
  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  return resposta.text();
}

function lerJson(caminho, padrao) {
  try {
    return JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  } catch {
    return padrao;
  }
}

// ---------------------------------------------------------------------------
// 1) Pedir ao Claude (API + busca na web) a lista de eventos
// ---------------------------------------------------------------------------
const MODELO = process.env.MODELO_IA || 'claude-sonnet-4-6';

function montarPedido(hoje, titulosJaCadastrados) {
  return `Hoje é ${hoje}. Pesquise na internet EVENTOS PRESENCIAIS NO BRASIL ligados ao universo do caminhão e do caminhoneiro que vão acontecer entre hoje e os próximos 12 meses: feiras de caminhões e de transporte rodoviário de cargas, encontros e festas de caminhoneiros, gincanas, corridas de caminhão (ex.: Copa Truck), exposições de caminhões e palestras/ações gratuitas para motoristas (ex.: SEST SENAT, PRF, postos de estrada).

Regras:
- Brasil inteiro, sem preferência de região.
- Só eventos com DATA CONFIRMADA (dia, mês e ano) e CIDADE conhecida.
- Não inclua eventos que já aconteceram nem eventos online.
- Não invente nada: cada evento precisa ter vindo de um resultado da sua busca, com o link da fonte (de preferência o site ou perfil oficial do evento).
- Não repita estes eventos, que já estão cadastrados: ${titulosJaCadastrados.join(' | ') || 'nenhum'}.
- Até 15 eventos, os mais próximos primeiro.

Responda SOMENTE com um JSON (sem texto antes ou depois, sem crases), no formato:
[{"titulo":"...","data_inicio":"AAAA-MM-DD","data_fim":"AAAA-MM-DD ou vazio","cidade":"...","uf":"SP","local":"nome do lugar ou vazio","descricao":"uma frase sobre o evento","gratuito":true/false/null,"link":"https://..."}]
Se não achar nada, responda [].`;
}

async function perguntarAoClaude(pedido) {
  const chaveApi = process.env.ANTHROPIC_API_KEY;
  const mensagens = [{ role: 'user', content: pedido }];
  let textoFinal = '';

  // Com busca na web a resposta pode vir "pausada" (pause_turn): aí é só continuar.
  for (let rodada = 0; rodada < 4; rodada++) {
    const resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': chaveApi,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 4000,
        messages: mensagens,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      }),
      signal: AbortSignal.timeout(240000),
    });
    const dados = await resposta.json();
    if (!resposta.ok) {
      throw new Error(`API da Anthropic respondeu ${resposta.status}: ${dados?.error?.message || JSON.stringify(dados)}`);
    }
    textoFinal += (dados.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (dados.stop_reason !== 'pause_turn') break;
    mensagens.push({ role: 'assistant', content: dados.content });
  }
  return textoFinal;
}

function extrairLista(texto) {
  const limpo = String(texto || '').replace(/```json|```/g, '');
  const inicio = limpo.indexOf('[');
  const fim = limpo.lastIndexOf(']');
  if (inicio < 0 || fim <= inicio) return [];
  try {
    const lista = JSON.parse(limpo.slice(inicio, fim + 1));
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2) Imagem do evento: tenta pegar a "og:image" da página oficial
// ---------------------------------------------------------------------------
function meta(html, prop) {
  const r = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  return (html.match(r) || html.match(r2) || [])[1] || '';
}

async function imagemDaPagina(url) {
  try {
    const html = await baixar(url);
    const img = meta(html, 'og:image') || meta(html, 'twitter:image');
    return /^https:\/\//.test(img) ? img.replace(/&amp;/g, '&') : '';
  } catch {
    return ''; // Instagram/Facebook costumam bloquear: fica sem imagem
  }
}

/** Confere e padroniza um evento vindo da IA. Devolve null se não servir. */
function validarEvento(bruto, hoje, limiteFuturo) {
  if (!bruto || typeof bruto !== 'object') return null;
  const inicio = String(bruto.data_inicio || '').slice(0, 10);
  let fim = String(bruto.data_fim || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fim) || fim <= inicio) fim = '';
  if ((fim || inicio) < hoje || inicio > limiteFuturo) return null;

  const link = String(bruto.link || '').trim();
  if (!/^https:\/\/[^\s]+$/.test(link)) return null;

  const cidade = limparTexto(bruto.cidade, 60);
  if (!cidade) return null;

  return {
    titulo: limparTexto(bruto.titulo, 120),
    inicio,
    fim,
    lugar: limparTexto(bruto.local, 90),
    cidade,
    uf: ufDe(bruto.uf),
    imagem: '',
    descricao: limparTexto(bruto.descricao, 400),
    gratuito: bruto.gratuito === true,
    fonte: fonteDoLink(link),
    link,
  };
}

function fonteDoLink(link) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, '');
    if (host.includes('instagram')) return 'Instagram oficial';
    if (host.includes('facebook')) return 'Facebook oficial';
    if (host.includes('sympla')) return 'Sympla';
    return host;
  } catch {
    return 'site do evento';
  }
}

function ehDoUniversoDoCaminhao(evento) {
  const titulo = normalizar(evento.titulo);
  const desc = normalizar(evento.descricao);
  return PALAVRAS_NO_TITULO.some((p) => titulo.includes(p)) || PALAVRAS_NA_DESCRICAO.some((p) => desc.includes(p));
}

// ---------------------------------------------------------------------------
// 3) Transformar no formato do eventos.json
// ---------------------------------------------------------------------------
function paraEventosJson(e) {
  const local = e.cidade ? `${e.cidade}${e.uf ? `/${e.uf}` : ''}` : e.uf || 'Brasil';
  const detalhes = [];
  detalhes.push(e.fim ? `De ${dataBR(e.inicio)} a ${dataBR(e.fim)}` : `Data: ${dataBR(e.inicio)}`);
  if (e.lugar) detalhes.push(`Local: ${e.lugar}${e.cidade ? `, ${local}` : ''}`);
  detalhes.push(e.gratuito ? 'Entrada gratuita' : 'Mais informações e ingressos no link');
  detalhes.push(`Fonte: ${e.fonte}`);

  return {
    titulo: e.titulo,
    data: e.inicio,
    local,
    detalhes,
    link: e.link,
    imagemUrl: e.imagem || null,
    origem: ORIGEM,
    encontradoEm: hojeISO(),
  };
}

function chave(titulo, data) {
  return `${normalizar(titulo).replace(/[^a-z0-9]/g, '')}|${data}`;
}

// ---------------------------------------------------------------------------
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('⚠️  Falta o segredo ANTHROPIC_API_KEY no GitHub (Settings → Secrets and variables → Actions).');
    console.warn('   Sem ele o robô não consegue pesquisar. Nada foi alterado.');
    return;
  }

  const fontes = lerJson(CAMINHO_FONTES, { ignorar: [] });
  const atuais = lerJson(CAMINHO_EVENTOS, null);
  if (!Array.isArray(atuais)) {
    console.error('❌ scripts/eventos.json não existe ou está com erro de sintaxe. Nada foi alterado.');
    process.exit(1);
  }

  const hoje = hojeISO();
  const limiteFuturo = somarDias(hoje, 365);
  const limiteLimpeza = somarDias(hoje, -30);

  // Limpa só eventos DO ROBÔ que já passaram há mais de 30 dias
  const mantidos = atuais.filter((e) => !(e.origem === ORIGEM && String(e.data) < limiteLimpeza));
  const removidos = atuais.length - mantidos.length;

  const jaExistem = new Set(mantidos.map((e) => chave(e.titulo, e.data)));
  const linksExistentes = new Set(mantidos.map((e) => e.link).filter(Boolean));
  const ignorar = new Set((fontes.ignorar || []).map((u) => String(u).split('?')[0]));
  const titulosFuturos = mantidos.filter((e) => String(e.data) >= hoje).map((e) => e.titulo);

  console.log(`🔎 Pedindo ao Claude (${MODELO}) para pesquisar eventos na internet...`);
  const texto = await perguntarAoClaude(montarPedido(hoje, titulosFuturos));
  const lista = extrairLista(texto);
  console.log(`📄 A pesquisa trouxe ${lista.length} evento(s). Conferindo...`);

  const aceitos = [];
  for (const bruto of lista) {
    const evento = validarEvento(bruto, hoje, limiteFuturo);
    const nome = limparTexto(bruto?.titulo, 80) || '(sem nome)';
    if (!evento) {
      console.log(`   ✗ ${nome}: sem data válida, cidade ou link — ignorado`);
      continue;
    }
    if (ignorar.has(evento.link.split('?')[0]) || linksExistentes.has(evento.link)) {
      console.log(`   ✗ ${nome}: já cadastrado ou na lista "ignorar"`);
      continue;
    }
    if (!ehDoUniversoDoCaminhao(evento)) {
      console.log(`   ✗ ${nome}: não parece ser do universo do caminhão`);
      continue;
    }
    if (jaExistem.has(chave(evento.titulo, evento.inicio))) {
      console.log(`   ✗ ${nome}: já está no site`);
      continue;
    }
    jaExistem.add(chave(evento.titulo, evento.inicio));
    aceitos.push(evento);
  }

  const escolhidos = aceitos.sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, MAX_NOVOS_POR_RODADA);
  for (const evento of escolhidos) {
    evento.imagem = await imagemDaPagina(evento.link);
    console.log(
      `   ✔ ${evento.titulo} — ${dataBR(evento.inicio)} — ${evento.cidade}/${evento.uf}${evento.imagem ? ' (com imagem)' : ' (sem imagem)'}`
    );
  }
  const novos = escolhidos.map(paraEventosJson);

  if (novos.length === 0 && removidos === 0) {
    console.log('✅ Nenhum evento novo esta semana. Nada foi alterado.');
    return;
  }

  const final = [...mantidos, ...novos];
  fs.writeFileSync(CAMINHO_EVENTOS, `${JSON.stringify(final, null, 2)}\n`, 'utf-8');
  console.log(`✅ ${novos.length} evento(s) novo(s) adicionado(s); ${removidos} evento(s) antigo(s) do robô removido(s).`);
}

main().catch((erro) => {
  console.error('❌ Erro no robô de eventos:', erro.message);
  process.exit(1);
});
