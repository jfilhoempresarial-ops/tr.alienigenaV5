import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'aniversariantes';

function diasDaSemanaAtual() {
  const hoje = new Date();
  const diaSemana = hoje.getDay();
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - diaSemana);

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(domingo);
    d.setDate(domingo.getDate() + i);
    dias.push({ dia: d.getDate(), mes: d.getMonth() + 1, ordem: i });
  }
  return dias;
}

/**
 * Busca todos os aniversariantes cadastrados no Firestore (importados via
 * scripts/importar-aniversariantes.cjs) e filtra apenas os que caem
 * dentro da semana atual.
 */
export async function buscarAniversariantesDaSemana() {
  let todos = [];
  try {
    const ref = collection(db, COLLECTION);
    const snapshot = await getDocs(query(ref, orderBy('dia', 'asc')));
    todos = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (erro) {
    console.error('Erro ao buscar aniversariantes:', erro);
    return [];
  }

  const semana = diasDaSemanaAtual();

  return todos
    .filter((a) => semana.some((s) => s.dia === a.dia && s.mes === a.mes))
    .map((a) => ({ ...a, ordem: semana.find((s) => s.dia === a.dia && s.mes === a.mes).ordem }))
    .sort((a, b) => a.ordem - b.ordem);
}