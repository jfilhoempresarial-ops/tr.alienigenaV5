import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'eventos';

/**
 * Busca eventos ativos, ordenados por data (mais próximo primeiro).
 */
export async function buscarEventosAtivos() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('ativo', '==', true), orderBy('data', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Cria um novo evento. Só funciona se o admin estiver autenticado (ver regras do Firestore). */
export async function criarEvento(dadosEvento) {
  const ref = collection(db, COLLECTION);
  const docRef = await addDoc(ref, { ...dadosEvento, ativo: true });
  return docRef.id;
}
