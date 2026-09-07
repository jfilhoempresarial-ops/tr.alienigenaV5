import {
  collection,
  addDoc,
  doc,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION_AVALIACOES = 'avaliacoes';
const COLLECTION_EMPRESAS = 'empresas';

/**
 * Registra uma avaliação (nota de 1 a 10 + comentário opcional) de uma
 * empresa, feita por um motorista logado com Google. Atualiza a média
 * (notaMedia) e o total (totalAvaliacoes) da empresa numa transação, e
 * grava um documento em "avaliacoes" com o nome de quem avaliou (tirado
 * do perfil do Google) e uma cópia do nome/categorias da empresa — assim
 * a lista de "últimas avaliações" não precisa buscar empresa por empresa.
 */
export async function avaliarEmpresa(empresaId, nota, comentario, usuario) {
  if (nota < 1 || nota > 10) {
    throw new Error('Nota inválida');
  }
  if (!usuario) {
    throw new Error('É preciso estar logado pra avaliar.');
  }

  const empresaRef = doc(db, COLLECTION_EMPRESAS, empresaId);
  let empresaNome = '';
  let empresaCategorias = [];

  await runTransaction(db, async (transaction) => {
    const empresaSnap = await transaction.get(empresaRef);
    if (!empresaSnap.exists()) throw new Error('Empresa não encontrada');

    const dados = empresaSnap.data();
    empresaNome = dados.nome || '';
    empresaCategorias = dados.categorias || [];

    const totalAtual = dados.totalAvaliacoes || 0;
    const somaAtual = (dados.notaMedia || 0) * totalAtual;

    const novoTotal = totalAtual + 1;
    const novaMedia = (somaAtual + nota) / novoTotal;

    transaction.update(empresaRef, {
      totalAvaliacoes: novoTotal,
      notaMedia: novaMedia,
    });
  });

  const avaliacoesRef = collection(db, COLLECTION_AVALIACOES);
  await addDoc(avaliacoesRef, {
    empresaId,
    empresaNome,
    empresaCategorias,
    nota,
    comentario: comentario || '',
    nomeAvaliador: usuario.displayName || 'Motorista',
    avaliadorEmail: usuario.email || '',
    avaliadorUid: usuario.uid,
    criadoEm: serverTimestamp(),
  });
}

/** Busca as empresas mais bem avaliadas (com pelo menos 1 avaliação). */
export async function buscarEmpresasMaisAvaliadas(quantidade = 6) {
  const ref = collection(db, COLLECTION_EMPRESAS);
  const q = query(
    ref,
    where('verificado', '==', true),
    where('totalAvaliacoes', '>', 0),
    orderBy('totalAvaliacoes'),
    orderBy('notaMedia', 'desc'),
    limit(quantidade)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

/**
 * Busca as avaliações mais recentes (de qualquer empresa), já com nota,
 * comentário e nome de quem avaliou. Se "categoria" for informado, filtra
 * só avaliações de empresas daquela categoria (usado nas páginas de
 * categoria, ex: só avaliações de Mecânico).
 */
export async function buscarUltimasAvaliacoes(quantidade = 6, categoria = null) {
  const ref = collection(db, COLLECTION_AVALIACOES);
  const condicoes = categoria ? [where('empresaCategorias', 'array-contains', categoria)] : [];
  const q = query(ref, ...condicoes, orderBy('criadoEm', 'desc'), limit(quantidade));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
