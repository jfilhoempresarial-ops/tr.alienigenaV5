import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'caminhoes_venda';

/** Busca anúncios já aprovados pelo admin, mais recente primeiro. */
export async function buscarCaminhoesVerificados() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('verificado', '==', true), orderBy('criadoEm', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Envia um anúncio novo, que entra como não-verificado até você aprovar manualmente. */
export async function cadastrarCaminhao(dados) {
  const ref = collection(db, COLLECTION);
  const docRef = await addDoc(ref, {
    ...dados,
    verificado: false,
    criadoEm: new Date().toISOString(),
  });
  return docRef.id;
}
