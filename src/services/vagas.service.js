import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';

/**
 * Busca a lista de vagas de transporte já capturadas do SINE/IDT.
 * Os dados são atualizados automaticamente 2x ao dia pelo GitHub Actions,
 * não pelo navegador do usuário.
 */
export async function buscarVagas() {
  const ref = doc(db, 'vagas', 'atual');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { itens: [], atualizado: null };
  }
  return snap.data();
}
