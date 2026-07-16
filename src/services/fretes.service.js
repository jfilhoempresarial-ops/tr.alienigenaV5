import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'fretes';

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
