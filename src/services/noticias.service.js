import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'noticias';
const DIAS_MAXIMOS = 30;

/** Retorna a data de corte (AAAA-MM-DD) de N dias atrás. */
function dataDeCorte(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10); // "AAAA-MM-DD"
}

/** Busca notícias ativas dos últimos 30 dias, mais recente primeiro. */
export async function buscarNoticiasAtivas() {
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where('ativo', '==', true),
    where('data', '>=', dataDeCorte(DIAS_MAXIMOS)),
    orderBy('data', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Busca as N manchetes mais recentes (últimos 30 dias) para exibir na home. */
export async function buscarManchetesHome(qtd = 3) {
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where('ativo', '==', true),
    where('data', '>=', dataDeCorte(DIAS_MAXIMOS)),
    orderBy('data', 'desc'),
    limit(qtd)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
