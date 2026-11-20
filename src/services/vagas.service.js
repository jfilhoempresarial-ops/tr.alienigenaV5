import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
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

/** Id do aviso a partir do link (o mesmo link avisado 2x vira 1 aviso só). */
function idDoAviso(link) {
  return String(link || '')
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .slice(0, 140);
}

/**
 * Motorista avisa: "essa vaga já foi encerrada". Vai para avisos_vagas,
 * que só o admin lê. Se a mesma vaga já foi avisada, não duplica.
 */
export async function avisarVagaEncerrada(vaga) {
  const id = idDoAviso(vaga.link);
  if (!id) throw new Error('Vaga sem link');
  try {
    await setDoc(doc(db, 'avisos_vagas', id), {
      cargo: String(vaga.cargo || '').slice(0, 150),
      empresa: String(vaga.empresa || '').slice(0, 150),
      cidade: String(vaga.cidade || '').slice(0, 80),
      link: String(vaga.link || '').slice(0, 600),
      fonte: String(vaga.fonte || '').slice(0, 20),
      confirmado: false,
      criadoEm: serverTimestamp(),
    });
  } catch (erro) {
    // Já existe aviso dessa vaga: tudo bem, o Júlio já vai conferir.
    if (erro && erro.code === 'permission-denied') return;
    throw erro;
  }
}

/** SÓ ADMIN: avisos de vaga encerrada ainda não resolvidos. */
export async function buscarAvisosVagas() {
  const snap = await getDocs(collection(db, 'avisos_vagas'));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((a) => !a.confirmado)
    .sort((a, b) => (b.criadoEm?.seconds || 0) - (a.criadoEm?.seconds || 0));
}

/** SÓ ADMIN: confirma (a vaga sai do site na próxima rodada do robô). */
export async function confirmarAvisoVaga(id) {
  await updateDoc(doc(db, 'avisos_vagas', id), { confirmado: true });
}

/** SÓ ADMIN: aviso errado, a vaga continua aberta. */
export async function ignorarAvisoVaga(id) {
  await deleteDoc(doc(db, 'avisos_vagas', id));
}
