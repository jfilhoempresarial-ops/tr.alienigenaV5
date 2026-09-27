/**
 * ROBÔ DE EVENTOS DO UNIVERSO DO CAMINHÃO (roda 1x por semana)
 *
 * Procura em fontes públicas de eventos (Sympla e Eventbrite) feiras,
 * encontros, festas, palestras e gincanas ligadas a caminhão/caminhoneiro
 * no Brasil inteiro, e ACRESCENTA os que achou no scripts/eventos.json —
 * o mesmo arquivo que alimenta a página de Eventos do site.
 * Depois o workflow roda o sincronizar-eventos.cjs, que publica no site.
 *
 * REGRAS DE SEGURANÇA:
 *   - Nunca mexe nos eventos que VOCÊ cadastrou no eventos.json. Os eventos
 *     do robô ficam marcados com "origem": "robo-eventos".
 *   - Só entra evento com data de hoje em diante, presencial, e com
 *     caminhão/caminhoneiro/truck/transporte no nome ou na descrição.
 *   - Não repete evento que já está no arquivo (mesmo nome e data).
 *   - No máximo MAX_NOVOS_POR_RODADA eventos novos por semana, para não
 *     encher a página de uma vez.
 *   - Eventos do robô que já passaram há mais de 30 dias são tirados do
 *     arquivo (o site já esconde evento passado no dia seguinte).
 *
 * NÃO QUER UM EVENTO QUE O ROBÔ COLOCOU? Abra scripts/eventos.json no
 * GitHub, apague o bloco dele e acrescente o link dele na lista
 * "ignorar" do arquivo scripts/fontes-eventos.json — assim ele não volta.
 *
 * QUER ACRESCENTAR UMA FONTE? Coloque o link da página do evento (ou de uma
 * página que liste eventos) em "paginasExtras" no scripts/fontes-eventos.json.
 *
 * Teste local (não precisa de chave, só lê a internet e mexe no JSON):
 *   node scripts/buscar-eventos-caminhao.cjs
 */

const fs = require('fs');
const path = require('path');

const CAMINHO_EVENTOS = path.join(__dirname, 'eventos.json');
const CAMINHO_FONTES = path.join(__dirname, 'fontes-eventos.json');
const ORIGEM = 'robo-eventos';
const MAX_NOVOS_POR_RODADA = 8;
const MAX_PAGINAS_DE_EVENTO = 60; // limite de páginas de evento abertas por rodada

const TERMOS_BUSCA = [
  'caminhoneiro',
  'caminhoneiros',
  'caminhao',
  'caminhoes',
  'truck',
  'feira do caminhao',
  'transporte rodoviario',
  'transporte de cargas',
];

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
// 1) Descobrir links de páginas de evento
// ---------------------------------------------------------------------------
function linksSympla(html) {
  const achados = html.match(/https?:\/\/(?:www\.)?sympla\.com\.br\/evento\/[a-z0-9-]+\/\d+/gi) || [];
  const relativos = (html.match(/["'](\/evento\/[a-z0-9-]+\/\d+)/gi) || []).map(
    (m) => `https://www.sympla.com.br${m.slice(1)}`
  );
  return [...achados, ...relativos];
}

function linksEventbrite(html) {
  return (html.match(/https?:\/\/www\.eventbrite\.com(?:\.br)?\/e\/[a-z0-9-]+-\d+/gi) || []).map((u) =>
    u.replace(/^http:/, 'https:')
  );
}

async function descobrirPaginas(fontes) {
  const paginas = new Set();

  for (const termo of TERMOS_BUSCA) {
    const tentativas = [
      ['Sympla', `https://www.sympla.com.br/eventos?s=${encodeURIComponent(termo)}`, linksSympla],
      ['Eventbrite', `https://www.eventbrite.com.br/d/brazil/${encodeURIComponent(termo.replace(/ /g, '-'))}/`, linksEventbrite],
    ];
    for (const [nome, url, extrair] of tentativas) {
      try {
        const links = extrair(await baixar(url));
        links.forEach((l) => paginas.add(l.split('?')[0]));
        console.log(`   • ${nome} "${termo}": ${links.length} links`);
      } catch (erro) {
        console.warn(`   • ${nome} "${termo}": falhou (${erro.message})`);
      }
    }
  }

  // Páginas extras que você cadastrou no fontes-eventos.json
  for (const url of fontes.paginasExtras || []) {
    paginas.add(url);
    try {
      const html = await baixar(url);
      [...linksSympla(html), ...linksEventbrite(html)].forEach((l) => paginas.add(l.split('?')[0]));
    } catch {
      // a própria página ainda vai ser lida na etapa 2
    }
  }

  const ignorar = new Set((fontes.ignorar || []).map((u) => u.split('?')[0]));
  return [...paginas].filter((u) => !ignorar.has(u)).slice(0, MAX_PAGINAS_DE_EVENTO);
}

// ---------------------------------------------------------------------------
// 2) Ler os dados de cada evento (padrão schema.org "Event" que esses sites usam)
// ---------------------------------------------------------------------------
function blocosJsonLd(html) {
  const blocos = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = regex.exec(html))) {
    try {
      blocos.push(JSON.parse(m[1].trim()));
    } catch {
      // bloco com erro: ignora
    }
  }
  const todos = [];
  (function achatar(no) {
    if (!no || typeof no !== 'object') return;
    if (Array.isArray(no)) return no.forEach(achatar);
    todos.push(no);
    if (no['@graph']) achatar(no['@graph']);
    if (no.itemListElement) achatar(no.itemListElement);
    if (no.item) achatar(no.item);
  })(blocos);
  return todos;
}

function ehEvento(obj) {
  const tipo = [].concat(obj['@type'] || []).join(' ');
  return /Event|Festival/i.test(tipo);
}

function meta(html, prop) {
  const r = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`, 'i');
  const r2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  return (html.match(r) || html.match(r2) || [])[1] || '';
}

function imagemDe(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (Array.isArray(img)) return imagemDe(img[0]);
  return img.url || img.contentUrl || '';
}

function lerEvento(html, url) {
  const ld = blocosJsonLd(html).find(ehEvento);
  let titulo, inicio, fim, lugar, cidade, uf, imagem, descricao, gratuito, online;

  if (ld) {
    titulo = ld.name;
    inicio = String(ld.startDate || '').slice(0, 10);
    fim = String(ld.endDate || '').slice(0, 10);
    const loc = [].concat(ld.location || [])[0] || {};
    online = /Online/i.test(String(ld.eventAttendanceMode || '')) || loc['@type'] === 'VirtualLocation';
    const end = loc.address || {};
    lugar = loc.name || '';
    cidade = typeof end === 'string' ? '' : end.addressLocality || '';
    uf = typeof end === 'string' ? '' : ufDe(end.addressRegion);
    imagem = imagemDe(ld.image);
    descricao = ld.description || '';
    const ofertas = [].concat(ld.offers || []);
    gratuito = ld.isAccessibleForFree === true || (ofertas.length > 0 && ofertas.every((o) => Number(o.price || o.lowPrice || 0) === 0));
  }

  // Plano B: dados das "etiquetas" da página (og:) e datas no código da página
  titulo = titulo || meta(html, 'og:title');
  imagem = imagem || meta(html, 'og:image');
  descricao = descricao || meta(html, 'og:description') || meta(html, 'description');
  if (!inicio) {
    const d = html.match(/"(?:startDate|start_date|startsAt)"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
    inicio = d ? d[1] : '';
  }
  if (!fim) {
    const d = html.match(/"(?:endDate|end_date|endsAt)"\s*:\s*"(\d{4}-\d{2}-\d{2})/);
    fim = d ? d[1] : '';
  }

  if (!titulo || !/^\d{4}-\d{2}-\d{2}$/.test(inicio || '')) return null;

  return {
    titulo: limparTexto(titulo, 120),
    inicio,
    fim: /^\d{4}-\d{2}-\d{2}$/.test(fim || '') && fim > inicio ? fim : '',
    lugar: limparTexto(lugar, 90),
    cidade: limparTexto(cidade, 60),
    uf,
    imagem: /^https:\/\//.test(imagem || '') ? imagem : '',
    descricao: limparTexto(descricao, 400),
    gratuito: Boolean(gratuito),
    online: Boolean(online),
    fonte: /sympla/i.test(url) ? 'Sympla' : /eventbrite/i.test(url) ? 'Eventbrite' : 'site do evento',
    link: url,
  };
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
  const fontes = lerJson(CAMINHO_FONTES, { paginasExtras: [], ignorar: [] });
  const atuais = lerJson(CAMINHO_EVENTOS, null);
  if (!Array.isArray(atuais)) {
    console.error('❌ scripts/eventos.json não existe ou está com erro de sintaxe. Nada foi alterado.');
    process.exit(1);
  }

  const hoje = hojeISO();
  const limiteLimpeza = somarDias(hoje, -30);

  // Limpa só eventos DO ROBÔ que já passaram há mais de 30 dias
  const mantidos = atuais.filter((e) => !(e.origem === ORIGEM && String(e.data) < limiteLimpeza));
  const removidos = atuais.length - mantidos.length;

  const jaExistem = new Set(mantidos.map((e) => chave(e.titulo, e.data)));
  const linksExistentes = new Set(mantidos.map((e) => e.link).filter(Boolean));

  console.log('🔎 Procurando eventos...');
  const paginas = (await descobrirPaginas(fontes)).filter((u) => !linksExistentes.has(u));
  console.log(`📄 ${paginas.length} páginas de evento para conferir.`);

  const encontrados = [];
  for (const url of paginas) {
    try {
      const evento = lerEvento(await baixar(url), url);
      if (!evento) continue;
      if (evento.online) continue;
      if ((evento.fim || evento.inicio) < hoje) continue;
      if (!ehDoUniversoDoCaminhao(evento)) continue;
      if (jaExistem.has(chave(evento.titulo, evento.inicio))) continue;
      jaExistem.add(chave(evento.titulo, evento.inicio));
      encontrados.push(evento);
      console.log(`   ✔ ${evento.titulo} — ${dataBR(evento.inicio)} — ${evento.cidade}/${evento.uf}`);
    } catch (erro) {
      console.warn(`   • ${url}: falhou (${erro.message})`);
    }
  }

  const novos = encontrados
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .slice(0, MAX_NOVOS_POR_RODADA)
    .map(paraEventosJson);

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
