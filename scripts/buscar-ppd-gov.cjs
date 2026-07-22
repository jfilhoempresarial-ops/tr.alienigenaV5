/**
 * Script de busca automática: lê a lista oficial de Pontos de Parada e
 * Descanso (PPD) certificados pelo Ministério dos Transportes e grava
 * cada um na coleção "empresas" do Firestore, na categoria "pontoapoio".
 *
 * A lista do governo NÃO tem telefone (só nome, cidade, UF e localização
 * na rodovia/KM) — por isso grava sem o campo "whatsapp". O card de
 * empresa já foi ajustado para esconder o botão de WhatsApp quando não
 * houver número, então isso não quebra nada na tela.
 *
 * SEGURO RODAR DE NOVO: cada PPD recebe um ID fixo (slug do nome + cidade),
 * então reimportar atualiza o mesmo registro em vez de duplicar.
 *
 * COMO USAR:
 *   node scripts/buscar-ppd-gov.cjs
 */

const path = require('path');
const cheerio = require('cheerio');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');
const URL_PPD = 'https://www.gov.br/transportes/pt-br/assuntos/transporte-terrestre_/portal-trc/ppd/lista-de-ppds-certificados';

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

initializeApp({
  credential: cert(carregarCredencial()),
});
const db = getFirestore();

function limpar(texto) {
  return (texto || '').replace(/\s+/g, ' ').trim();
}

function gerarId(nome, cidade) {
  const texto = `ppd-${nome}-${cidade}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return texto || `ppd-${Date.now()}`;
}

// Cache por cidade+UF: várias linhas da lista compartilham a mesma cidade
// (ex: duas em Feira de Santana), então geocodificamos cada cidade só uma
// vez, mesmo que apareça em várias linhas da tabela.
const cacheGeocodificacao = new Map();

/**
 * Geocodifica pelo nome da CIDADE (não temos endereço/KM exato pra geocodificar
 * com precisão) via Nominatim/OpenStreetMap, gratuito e sem precisar de chave.
 * O pino no mapa fica no centro da cidade, não na localização exata da rodovia
 * — é uma aproximação, mas já ajuda o motorista a saber que tem um PPD ali perto.
 * Respeita o limite de 1 requisição/segundo do Nominatim (uso justo, gratuito).
 */
async function geocodificarCidade(cidade, uf) {
  const chave = `${cidade}|${uf}`;
  if (cacheGeocodificacao.has(chave)) return cacheGeocodificacao.get(chave);

  let resultado = null;
  try {
    const consulta = encodeURIComponent(`${cidade}, ${uf}, Brasil`);
    const url = `https://nominatim.openstreetmap.org/search?q=${consulta}&format=json&limit=1&countrycodes=br`;
    const resposta = await fetch(url, {
      headers: { 'User-Agent': 'TRAdaEstrada-PPDScraper/1.0 (https://tralienigena.com.br)' },
    });
    const dados = await resposta.json();
    if (dados && dados[0]) {
      resultado = { lat: parseFloat(dados[0].lat), lng: parseFloat(dados[0].lon) };
    }
  } catch (erro) {
    console.warn(`⚠️  Não foi possível geocodificar "${cidade}/${uf}":`, erro.message);
  }

  cacheGeocodificacao.set(chave, resultado);
  await new Promise((r) => setTimeout(r, 1100)); // respeita o limite de 1 req/s do Nominatim
  return resultado;
}

/** Acha a tabela certa na página (pode ter várias tabelas escondidas no layout do site do governo)
 *  procurando pela que tem "NOME FANTASIA" no cabeçalho, e extrai as linhas. */
function extrairPpds(html) {
  const $ = cheerio.load(html);
  let linhasExtraidas = [];

  $('table').each((_, tabela) => {
    const cabecalho = limpar($(tabela).find('tr').first().text()).toUpperCase();
    if (!cabecalho.includes('NOME FANTASIA')) return;

    $(tabela)
      .find('tr')
      .slice(1) // pula o cabeçalho
      .each((_, linha) => {
        const celulas = $(linha)
          .find('td')
          .map((_, td) => limpar($(td).text()))
          .get();

        // Colunas esperadas: Nome, Cidade, UF, Localização, Jurisdição
        if (celulas.length < 4) return;
        const [nome, cidade, uf, localizacao] = celulas;
        if (!nome || !cidade || !uf) return; // linha vazia/quebrada, pula

        linhasExtraidas.push({ nome, cidade, uf, localizacao: localizacao || '' });
      });
  });

  return linhasExtraidas;
}

async function main() {
  console.log('Buscando lista de PPDs certificados...\n');

  const resposta = await fetch(URL_PPD, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resposta.ok) {
    throw new Error(`Falha ao acessar a página do governo: HTTP ${resposta.status}`);
  }
  const html = await resposta.text();

  const ppds = extrairPpds(html);
  console.log(`Total de PPDs encontrados na página: ${ppds.length}\n`);

  if (ppds.length === 0) {
    console.warn('⚠️  Nenhum PPD encontrado — a página pode ter mudado de estrutura (layout diferente do esperado).');
    console.warn('   Nada foi gravado, pra não arriscar apagar/sobrescrever dados por engano.');
    return;
  }

  let gravados = 0;
  for (const ppd of ppds) {
    const endereco = ppd.localizacao ? `${ppd.localizacao} — ${ppd.cidade}/${ppd.uf}` : `${ppd.cidade}/${ppd.uf}`;
    const id = gerarId(ppd.nome, ppd.cidade);
    const coordenadas = await geocodificarCidade(ppd.cidade, ppd.uf);

    const dados = {
      nome: ppd.nome,
      endereco,
      cidade: ppd.cidade,
      estado: ppd.uf,
      categorias: ['pontoapoio'],
      verificado: true,
      origem: 'ppd-gov-br',
      // Sem "whatsapp" de propósito — a lista oficial não traz telefone.
    };
    if (coordenadas) {
      dados.lat = coordenadas.lat;
      dados.lng = coordenadas.lng;
    }

    await db.collection('empresas').doc(id).set(dados, { merge: true });
    gravados++;
    console.log(`✅ (${gravados}/${ppds.length}) ${ppd.nome} — ${ppd.cidade}/${ppd.uf}${coordenadas ? '' : ' (sem coordenada)'}`);
  }

  console.log(`🎉 Concluído! ${gravados} PPDs gravados/atualizados na categoria "Pontos de Apoio".`);
}

main().catch((erro) => {
  console.error('❌ Erro ao buscar PPDs:', erro);
  process.exit(1);
});
