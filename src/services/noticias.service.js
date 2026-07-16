import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'noticias';

/** Busca notícias ativas, mais recente primeiro. */
export async function buscarNoticiasAtivas() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('ativo', '==', true), orderBy('data', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Busca as N manchetes mais recentes para exibir na home. */
export async function buscarManchetesHome(qtd = 3) {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('ativo', '==', true), orderBy('data', 'desc'), limit(qtd));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}