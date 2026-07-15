import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'grupos_whatsapp';

// O cadastro de grupos parceiros é feito manualmente pelo admin (console do
// Firebase), mesmo padrão usado nos banners — não existe formulário público.
const EXEMPLOS = [
  { nomeGrupo: 'Caminhoneiros de Sobral', responsavel: 'Zé da Estrada', cidade: 'Sobral/CE', whatsapp: '5588999999999', isExemplo: true },
  { nomeGrupo: 'Rota do Nordeste', responsavel: 'Marcos Silva', cidade: 'Fortaleza/CE', whatsapp: '5588999999999', isExemplo: true },
];

export async function buscarGruposWhatsappAtivos() {
  try {
    const ref = collection(db, COLLECTION);
    const q = query(ref, where('ativo', '==', true), orderBy('ordem', 'asc'));
    const snapshot = await getDocs(q);
    const itens = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (itens.length > 0) return itens;
  } catch (erro) {
    console.error('Erro ao buscar grupos de WhatsApp:', erro);
  }
  return EXEMPLOS;
}
