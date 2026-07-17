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
 * Registra uma avaliação anônima (nota de 1 a 10) para uma empresa,
 * e atualiza a média (notaMedia) e o total (totalAvaliacoes) direto no
 * documento da empresa, dentro de uma transação para evitar corrida
 * entre avaliações simultâneas.
 */
export async function avaliarEmpresa(empresaId, nota) {
  if (nota < 1 || nota > 10) {
    throw new Error('Nota inválida');
  }

  const empresaRef = doc(db, COLLECTION_EMPRESAS, empresaId);

  await runTransaction(db, async (transaction) => {
    const empresaSnap = await transaction.get(empresaRef);
    if (!empresaSnap.exists()) throw new Error('Empresa não encontrada');

    const dados = empresaSnap.data();
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
    nota,
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
