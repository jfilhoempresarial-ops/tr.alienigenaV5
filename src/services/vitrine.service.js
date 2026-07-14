import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'vitrine';

/**
 * Busca os anunciantes ativos da "vitrine de marcas" — os cards pequenos
 * com foto de fundo + nome, que levam pro link que a empresa escolher
 * (WhatsApp, site, Instagram, etc). É o espaço publicitário mais barato,
 * separado do banner grande do topo.
 */
export async function buscarVitrineAtiva() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('ativo', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

