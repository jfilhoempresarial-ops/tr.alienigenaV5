import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'fretes';

// Usados só se a coleção "fretes" ainda estiver vazia no Firestore,
// para a tela não ficar em branco antes da primeira importação.
const EXEMPLOS = [
  { veiculo: 'Truck', carroceria: 'Baú', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Tianguá', estadoDestino: 'CE', carga: 'Carga geral', especie: 'Geral', isExemplo: true },
  { veiculo: 'Carreta', carroceria: 'Graneleira', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'Ipu', estadoDestino: 'CE', carga: 'Grãos', especie: 'Granel', isExemplo: true },
  { veiculo: 'Bitrem', carroceria: 'Caçamba', cidadeOrigem: 'Sobral', estadoOrigem: 'CE', cidadeDestino: 'São Benedito', estadoDestino: 'CE', carga: 'Areia', especie: 'Granel', isExemplo: true },
];

/**
 * Busca fretes cadastrados no Firestore (importados via
 * scripts/importar-fretes.cjs). Se ainda não houver nenhum,
 * cai de volta nos exemplos fixos, marcados com isExemplo: true.
 */
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