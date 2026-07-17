import { collection, getDocs, query, where, doc, updateDoc, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'banners';
const CLIQUES_COLLECTION = 'banner_cliques';

/** Embaralha um array (Fisher-Yates), sem alterar o original. */
function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/**
 * Busca banners ativos que tenham a tag/categoria informada dentro do
 * campo "categorias" (array). Cobre tanto posições fixas do site
 * ("topo", "pertodevoce", "home-vertical") quanto categorias reais
 * (ex: "posto", "mecanico") — um mesmo banner pode ter várias tags.
 * A ordem retornada é aleatória a cada chamada.
 */
export async function buscarBannersPorCategoria(tag) {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('ativo', '==', true), where('categorias', 'array-contains', tag));
  const snapshot = await getDocs(q);
  const banners = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return embaralhar(banners);
}

/** Busca os banners do carrossel principal (topo da home). */
export async function buscarBannersAtivos() {
  return buscarBannersPorCategoria('topo');
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