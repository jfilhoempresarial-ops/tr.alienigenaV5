import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'empresas';

/**
 * Busca empresas por categoria (ex: "mecanico", "borracharia").
 * Filtra só as já verificadas por padrão.
 */
export async function buscarEmpresasPorCategoria(categoria, { apenasVerificadas = true } = {}) {
  const ref = collection(db, COLLECTION);
  const condicoes = [where('categorias', 'array-contains', categoria)];
  if (apenasVerificadas) {
    condicoes.push(where('verificado', '==', true));
  }
  const q = query(ref, ...condicoes);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca uma amostra de empresas verificadas para exibir em destaque na home.
 * Ainda não ordena por distância (isso passa a funcionar quando todas as
 * empresas tiverem lat/lng preenchidos pelo script de geocodificação).
 */
export async function buscarEmpresasDestaque(quantidade = 6) {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('verificado', '==', true), limit(quantidade));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca TODAS as empresas verificadas, de qualquer categoria.
 * Usado pela busca global do site (buscar.service.js).
 */
export async function buscarTodasEmpresas() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('verificado', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/** Cadastra uma nova empresa (entra como não-verificada até aprovação manual). */
export async function cadastrarEmpresa(dadosEmpresa) {
  const ref = collection(db, COLLECTION);
  const docRef = await addDoc(ref, {
    ...dadosEmpresa,
    verificado: false,
    criadoEm: new Date().toISOString(),
  });
  return docRef.id;
}

/** Lista todas as empresas pendentes de aprovação (uso no painel admin). */
export async function buscarEmpresasPendentes() {
  const ref = collection(db, COLLECTION);
  const q = query(ref, where('verificado', '==', false));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
