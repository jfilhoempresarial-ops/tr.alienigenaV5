import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'noticias';

/** Busca notícias ativas, mais recente primeiro. Opcionalmente filtra por categoria. */
export async function buscarNoticiasAtivas(categoria = null) {
  const ref = collection(db, COLLECTION);
  const condicoes = [where('ativo', '==', true)];
  if (categoria) condicoes.push(where('categoria', '==', categoria));
  const q = query(ref, ...condicoes, orderBy('data', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Usado na home: só as manchetes mais recentes, de qualquer categoria. */
export async function buscarManchetesHome(quantidade = 3) {
  const todas = await buscarNoticiasAtivas();
  return todas.slice(0, quantidade);
}
