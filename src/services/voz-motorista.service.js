import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';

/**
 * Vídeos do Programa "A Voz do Motorista", atualizados automaticamente
 * pelo script scripts/atualizar-video-voz-motorista.cjs (sábado e domingo).
 * Devolve [{ videoId, titulo }], o mais recente primeiro — ou [] se ainda não houver.
 */
export async function buscarVideosVozMotorista() {
  const snapshot = await getDoc(doc(db, 'configuracoes', 'voz-motorista'));
  if (!snapshot.exists()) return [];
  const videos = snapshot.data().videos || [];
  return videos.filter((v) => v && v.videoId);
}
