import { collection, getDocs, query, where, orderBy, doc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'banners';
const CLIQUES_COLLECTION = 'banner_cliques';

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

/**
 * Busca banners ativos de uma categoria específica (ex: "vagas", "mecanico"),
 * para exibir no topo das páginas de cada categoria.
 * O banner precisa ter o campo "categoria" preenchido no Firestore com o
 * mesmo id usado no array CATEGORIAS do home.js.
 */
export async function buscarBannersPorCategoria(categoriaId) {
  const ref = collection(db, COLLECTION);
  const q = query(
    ref,
    where('ativo', '==', true),
    where('categoria', '==', categoriaId),
    orderBy('ordem', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Registra um clique no banner: soma +1 no contador do banner
 * E grava um evento individual (com data) para o relatório mensal.
 * "Fire and forget" — não trava a navegação do usuário pro WhatsApp/site.
 */
export function registrarClique(bannerId, empresaNome) {
  const bannerRef = doc(db, COLLECTION, bannerId);
  updateDoc(bannerRef, { cliques: increment(1) }).catch((erro) => console.error('Erro ao contar clique:', erro));

  const cliquesRef = collection(db, CLIQUES_COLLECTION);
  addDoc(cliquesRef, {
    bannerId,
    empresaNome,
    criadoEm: serverTimestamp(),
  }).catch((erro) => console.error('Erro ao registrar clique:', erro));
}