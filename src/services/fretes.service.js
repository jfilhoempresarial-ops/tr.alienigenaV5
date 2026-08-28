import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'fretes';

// Tempo que os fretes ficam guardados no navegador antes de buscar de novo
// no Firestore. Fretes não mudam segundo a segundo, então 15 minutos é um
// bom equilíbrio entre "dados atualizados" e "não estourar a cota de leitura".
const CACHE_TTL_MS = 15 * 60 * 1000;
const CACHE_KEY = 'tra:fretes:cache';

// Cidades com mais visualização no Instagram nos últimos 30 dias.
// Revisar/atualizar essa lista toda semana conforme os dados do Instagram —
// é só editar esse array, o resto do filtro se adapta sozinho.
const CIDADES_ALVO = ['São Paulo', 'Fortaleza', 'Goiânia', 'São Luís', 'Sobral'];

export const NOME_ESTADO = {
  CE: 'Ceará', PI: 'Piauí', MA: 'Maranhão', PE: 'Pernambuco', RN: 'Rio Grande do Norte',
  PB: 'Paraíba', BA: 'Bahia', GO: 'Goiás', SP: 'São Paulo', MG: 'Minas Gerais',
  PR: 'Paraná', SC: 'Santa Catarina', RS: 'Rio Grande do Sul', DF: 'Distrito Federal',
  MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', PA: 'Pará', AM: 'Amazonas',
  ES: 'Espírito Santo', RJ: 'Rio de Janeiro', TO: 'Tocantins', RO: 'Rondônia',
  AC: 'Acre', RR: 'Roraima', AP: 'Amapá', AL: 'Alagoas', SE: 'Sergipe',
};

const EXEMPLOS = [
  { veiculo: 'Truck', carroceria: 'Baú', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Tianguá', estadoDestino: 'CE', carga: 'Carga geral', especie: 'Geral', preco: '55,00', pesoTon: 14, obs: null, isExemplo: true },
  { veiculo: 'Carreta', carroceria: 'Graneleira', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Ipu', estadoDestino: 'CE', carga: 'Grãos', especie: 'Granel', preco: '35,00', pesoTon: 28, obs: null, isExemplo: true },
  { veiculo: 'Bitrem', carroceria: 'Caçamba', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Teresina', estadoDestino: 'PI', carga: 'Areia', especie: 'Granel', preco: '65,00', pesoTon: 32, obs: null, isExemplo: true },
];

/** Remove acentos e normaliza maiúsculas/minúsculas para comparar nomes de cidade com segurança. */
function normalizarNomeCidade(nome) {
  if (!nome) return '';
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim()
    .toLowerCase();
}

const CIDADES_ALVO_NORMALIZADAS = CIDADES_ALVO.map(normalizarNomeCidade);

/**
 * Mantém só os fretes cuja cidade de origem OU destino está na lista de
 * cidades-alvo (foco atual: maior engajamento no Instagram nos últimos 30 dias).
 */
function filtrarPorCidadesAlvo(itens) {
  return itens.filter((item) => {
    const origem = normalizarNomeCidade(item.cidadeOrigem);
    const destino = normalizarNomeCidade(item.cidadeDestino);
    return CIDADES_ALVO_NORMALIZADAS.includes(origem) || CIDADES_ALVO_NORMALIZADAS.includes(destino);
  });
}

/** Lê o cache do sessionStorage, se ainda estiver dentro da validade. */
function lerCache() {
  try {
    const bruto = sessionStorage.getItem(CACHE_KEY);
    if (!bruto) return null;

    const { salvoEm, itens } = JSON.parse(bruto);
    if (!salvoEm || !Array.isArray(itens)) return null;
    if (Date.now() - salvoEm > CACHE_TTL_MS) return null; // expirou

    return itens;
  } catch (erro) {
    // sessionStorage indisponível (modo privado, iframe restrito, etc.) ou
    // JSON corrompido — não é motivo pra quebrar a página, só ignora o cache.
    console.warn('Cache de fretes indisponível, buscando direto do Firestore:', erro);
    return null;
  }
}

/** Salva a lista buscada no sessionStorage, com timestamp de quando foi salva. */
function salvarCache(itens) {
  try {
    sessionStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ salvoEm: Date.now(), itens })
    );
  } catch (erro) {
    // Sem espaço no storage ou indisponível — segue o jogo sem cache.
    console.warn('Não foi possível salvar o cache de fretes:', erro);
  }
}

export async function buscarTodosFretes() {
  const doCache = lerCache();
  if (doCache) return doCache;

  try {
    const ref = collection(db, COLLECTION);
    const q = query(ref, orderBy('criadoEm', 'desc'));
    const snapshot = await getDocs(q);
    const todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const itens = filtrarPorCidadesAlvo(todos);

    if (itens.length > 0) {
      salvarCache(itens);
      return itens;
    }
  } catch (erro) {
    console.error('Erro ao buscar fretes:', erro);
  }
  return filtrarPorCidadesAlvo(EXEMPLOS);
}

/**
 * Força a próxima chamada a ignorar o cache e buscar direto do Firestore.
 * Útil, por exemplo, em um botão "Atualizar fretes" na própria página.
 */
export function limparCacheFretes() {
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // sem problema se não conseguir limpar — o cache vai expirar sozinho pelo TTL
  }
}