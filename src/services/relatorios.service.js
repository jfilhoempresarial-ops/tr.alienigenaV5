import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const CLIQUES_COLLECTION = 'banner_cliques';

/**
 * Busca todos os eventos de clique e agrupa por empresa + mês/ano.
 * Retorna algo como:
 * [{ empresaNome, mesAno: "2026-07", totalCliques: 42 }, ...]
 */
export async function gerarRelatorioCliques() {
  const ref = collection(db, CLIQUES_COLLECTION);
  const q = query(ref, orderBy('criadoEm', 'desc'));
  const snapshot = await getDocs(q);

  const contagem = {};

  snapshot.docs.forEach((doc) => {
    const dado = doc.data();
    if (!dado.criadoEm) return; // ignora eventos ainda sem timestamp confirmado pelo servidor

    const data = dado.criadoEm.toDate();
    const mesAno = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
    const chave = `${dado.empresaNome}__${mesAno}`;

    if (!contagem[chave]) {
      contagem[chave] = { empresaNome: dado.empresaNome, mesAno, totalCliques: 0 };
    }
    contagem[chave].totalCliques += 1;
  });

  return Object.values(contagem).sort((a, b) => b.mesAno.localeCompare(a.mesAno));
}
