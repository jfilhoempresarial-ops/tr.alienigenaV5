import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'fretes';

const EXEMPLOS = [
  { veiculo: 'Truck', carroceria: 'Baú', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Tianguá', estadoDestino: 'CE', carga: 'Carga geral', especie: 'Geral', preco: '55,00', pesoTon: 14, obs: null, isExemplo: true },
  { veiculo: 'Carreta', carroceria: 'Graneleira', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Ipu', estadoDestino: 'CE', carga: 'Grãos', especie: 'Granel', preco: '35,00', pesoTon: 28, obs: null, isExemplo: true },
  { veiculo: 'Bitrem', carroceria: 'Caçamba', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'São Benedito', estadoDestino: 'CE', carga: 'Areia', especie: 'Granel', preco: '65,00', pesoTon: 32, obs: null, isExemplo: true },
];

/** Usado na home — só uma amostra recente. */
export async function buscarFretesDestaque(quantidade = 3) {
  try {
    const ref = collection(db, COLLECTION);
    const q = query(ref, orderBy('criadoEm', 'desc'), limit(quantidade));
    const snapshot = await getDocs(q);
    const itens = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (itens.length > 0) return itens;
  } catch (erro) {
    console.error('Erro ao buscar fretes:', erro);
  }
  return EXEMPLOS.slice(0, quantidade);
}

/** Usado na página completa de fretes (/fretes) — lista tudo. */
export async function buscarTodosFretes() {
  try {
    const ref = collection(db, COLLECTION);
    const q = query(ref, orderBy('criadoEm', 'desc'));
    const snapshot = await getDocs(q);
    const itens = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (itens.length > 0) return itens;
  } catch (erro) {
    console.error('Erro ao buscar fretes:', erro);
  }
  return EXEMPLOS;
}