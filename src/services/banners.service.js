import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'banners';

/**
 * Busca banners ativos, ordenados pelo campo "ordem".
 * O cadastro de banners é feito manualmente pelo admin (console do Firebase),
 * não existe formulário público — é um espaço pago.
 */
export async function buscarBannersAtivos() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('ativo', '==', true), orderBy('ordem', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
