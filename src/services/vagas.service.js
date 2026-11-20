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

/**
 * SÓ ADMIN: empresas que oferecem as vagas do SINE.
 * Fica em vagas_admin/atual, que a regra do Firestore libera só para o
 * e-mail do admin. Para qualquer outra pessoa, o Firestore recusa a leitura.
 */
export async function buscarEmpresasDasVagas() {
  const snap = await getDoc(doc(db, 'vagas_admin', 'atual'));
  if (!snap.exists()) return { empresas: [], atualizado: null };
  return snap.data();
}

/**
 * Aba "Outras vagas": Jooble + Vagas Indicadas da planilha.
 * Atualizado 2x por dia pelo robô buscar-outras-vagas.cjs.
 */
export async function buscarOutrasVagas() {
  const snap = await getDoc(doc(db, 'outras_vagas', 'atual'));
  if (!snap.exists()) return { itens: [], atualizado: null };
  return snap.data();
}
