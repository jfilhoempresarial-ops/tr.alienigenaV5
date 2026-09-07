import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';

/** Busca as cotações (dólar, diesel, gasolina, etanol, petróleo) pra fita do topo. */
export async function buscarCotacoes() {
  const ref = doc(db, 'configuracoes', 'cotacoes');
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  return snap.data().itens || [];
}
