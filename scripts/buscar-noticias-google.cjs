/**
 * Script de busca automática de notícias: consulta o Google News RSS
 * usando as palavras-chave do universo caminhoneiro/transporte de cargas,
 * classifica cada notícia numa categoria e grava na coleção "noticias"
 * do Firestore — no mesmo formato que o card da home já espera
 * (imagemUrl, categoria, data, titulo, link).
 *
 * SEGURO RODAR VÁRIAS VEZES POR DIA: cada notícia recebe um ID fixo
 * (hash do link), então rodar de novo atualiza a mesma notícia em vez
 * de duplicar.
 *
 * Notícias raspadas NÃO têm o campo "texto" — isso faz o card do site
 * tratar como link externo (abre a matéria original em nova aba, com
 * o link/fonte, em vez de tentar montar uma página própria).
 *
 * COMO USAR:
 *   node scripts/buscar-noticias-google.cjs
 */

const crypto = require('crypto');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

/** No GitHub Actions vem via secret (base64). Localmente, cai no arquivo serviceAccountKey.json. */
function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

// ---------- CONFIGURAÇÃO ----------

// Palavras-chave do universo caminhoneiro (CLT, autônomo, agregado,
// legislação, economia do frete, rodovia).
const PALAVRAS_CHAVE = [
  'caminhoneiro',
  'motorista de caminhão',
  'frete',
  'piso mínimo do frete',
  'tabela de frete ANTT',
  'CLT motorista',
  'motorista autônomo',
  'motorista agregado',
  'jornada de trabalho caminhoneiro',
  'hora extra motorista',
  'lei do caminhoneiro',
  'reforma tributária transporte de cargas',
  'ANTT',
  'pedágio caminhão',
  'diesel preço',
  'rodovia federal interdição',
  'greve dos caminhoneiros',
  'transporte de cargas Brasil',
  'licenciamento caminhão',
  'concurso categoria caminhão CNH',
];

// Só grava notícia publicada nos últimos N dias (evita reimportar coisa velha).
const DIAS_MAXIMOS = 3;

// Máximo de notícias novas gravadas por execução (evita lotar o Firestore
// de uma vez só se muita coisa saiu ao mesmo tempo).
const MAXIMO_POR_EXECUCAO = 15;

// Imagem usada quando não é possível pegar a foto real da matéria (ou quando
// só se consegue o ícone genérico do próprio Google News, não da fonte).
const IMAGEM_PADRAO = '/images/tra-news-logo.png';
// -----------------------------------

initializeApp({
  credential: cert(carregarCredencial()),
});
const db = getFirestore();

// Classifica a notícia numa das categorias que o site já reconhece,
// por palavra-chave no título. Cai em "geral" se não bater com nada.
const REGRAS_CATEGORIA = [
  { categoria: 'clt', termos: ['clt'] },
  { categoria: 'autonomo', termos: ['autônomo', 'autonomo'] },
  { categoria: 'agregado', termos: ['agregado'] },
  { categoria: 'legislacao', termos: ['lei ', 'legisla', 'projeto de lei', 'câmara aprova', 'senado aprova'] },
  { categoria: 'mobilizacao', termos: ['greve', 'manifesta', 'bloqueio', 'protesto', 'paralisa'] },
  { categoria: 'seguranca', termos: ['acidente', 'segurança', 'seguranca', 'colisão', 'colisao', 'tombou'] },
  { categoria: 'direitos', termos: ['direito', 'indeniza', 'trabalhista', 'justiça do trabalho'] },
  { categoria: 'rodovia', termos: ['rodovia', 'br-', 'pedágio', 'pedagio', 'estrada', 'interdi'] },
];

function classificarCategoria(titulo) {
  const tituloMin = titulo.toLowerCase();
  for (const regra of REGRAS_CATEGORIA) {
    if (regra.termos.some((t) => tituloMin.includes(t))) return regra.categoria;
  }
  return 'geral';
}

function gerarIdNoticia(link) {
  return crypto.createHash('md5').update(link).digest('hex');
}

/** Remove o " - Nome da Fonte" que o Google News sempre cola no fim do título. */
function limparTitulo(tituloRss) {
  const partes = tituloRss.split(' - ');
  if (partes.length > 1) partes.pop();
  return partes.join(' - ').trim();
}

function decodificarEntidadesHtml(texto) {
  return texto
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** Extrai os itens <item>...</item> de um XML de RSS via regex (sem dependência externa). */
function extrairItensRss(xml) {
  const itens = [];
  const blocos = xml.split('<item>').slice(1);
  for (const bloco of blocos) {
    const tituloMatch = bloco.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = bloco.match(/<link>([\s\S]*?)<\/link>/);
    const dataMatch = bloco.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    if (!tituloMatch || !linkMatch) continue;
    itens.push({
      titulo: decodificarEntidadesHtml(tituloMatch[1].replace('<![CDATA[', '').replace(']]>', '').trim()),
      link: linkMatch[1].trim(),
      pubDate: dataMatch ? dataMatch[1].trim() : null,
    });
  }
  return itens;
}

async function buscarNoticiasPorPalavra(palavraChave) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(palavraChave)}&hl=pt-BR&gl=BR&ceid=BR:pt-BR`;
  const resposta = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resposta.ok) {
    console.warn(`⚠️  Falha ao buscar "${palavraChave}": HTTP ${resposta.status}`);
    return [];
  }
  const xml = await resposta.text();
  return extrairItensRss(xml).map((item) => ({ ...item, titulo: limparTitulo(item.titulo) }));
}

/** Tenta pegar a imagem de capa (og:image) da matéria original. Não trava o script se falhar. */
async function tentarBuscarImagem(link) {
  try {
    const controlador = new AbortController();
    const timeout = setTimeout(() => controlador.abort(), 5000);
    const resposta = await fetch(link, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controlador.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    if (!resposta.ok) return null;
    const html = await resposta.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    if (!match) return null;
    const urlImagem = match[1];
    // Se o redirecionamento não saiu do domínio do Google, a imagem capturada
    // é o ícone genérico do Google News, não a foto da matéria — descarta.
    if (/(^|\.)google(usercontent)?\.com|gstatic\.com/i.test(urlImagem)) return null;
    return urlImagem;
  } catch {
    return null; // fonte bloqueou, deu timeout, etc. — segue sem imagem, cai no fallback.
  }
}

function dataDeCorte(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}

async function main() {
  console.log(`Buscando notícias para ${PALAVRAS_CHAVE.length} palavras-chave...\n`);

  const corte = dataDeCorte(DIAS_MAXIMOS);
  const encontradas = new Map(); // dedup por link, mesmo vindo de palavras-chave diferentes

  for (const palavra of PALAVRAS_CHAVE) {
    const itens = await buscarNoticiasPorPalavra(palavra);
    for (const item of itens) {
      if (!item.pubDate) continue;
      const dataPublicacao = new Date(item.pubDate);
      if (Number.isNaN(dataPublicacao.getTime()) || dataPublicacao < corte) continue;
      if (!encontradas.has(item.link)) {
        encontradas.set(item.link, { ...item, dataPublicacao });
      }
    }
  }

  const listaFinal = [...encontradas.values()]
    .sort((a, b) => b.dataPublicacao - a.dataPublicacao)
    .slice(0, MAXIMO_POR_EXECUCAO);

  console.log(`Total únicas encontradas (últimos ${DIAS_MAXIMOS} dias): ${encontradas.size}`);
  console.log(`Gravando as ${listaFinal.length} mais recentes...\n`);

  let gravadas = 0;
  for (const noticia of listaFinal) {
    const imagemUrl = await tentarBuscarImagem(noticia.link);
    const id = gerarIdNoticia(noticia.link);
    const dados = {
      titulo: noticia.titulo,
      link: noticia.link,
      categoria: classificarCategoria(noticia.titulo),
      data: noticia.dataPublicacao.toISOString().slice(0, 10),
      ativo: true,
      origem: 'google-news',
    };
    if (imagemUrl) dados.imagemUrl = imagemUrl;
    else dados.imagemUrl = IMAGEM_PADRAO;

    await db.collection('noticias').doc(id).set(dados, { merge: true });
    gravadas++;
    console.log(`✅ (${gravadas}) [${dados.categoria}] ${dados.titulo}`);
  }

  console.log(`\n🎉 Concluído! ${gravadas} notícias gravadas/atualizadas.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao buscar notícias:', erro);
  process.exit(1);
});
