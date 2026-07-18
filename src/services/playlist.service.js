import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config.js';

/** Busca a lista de músicas da playlist (cadastrada pelo script importar-playlist.cjs). */
export async function buscarPlaylist() {
  const ref = doc(db, 'configuracoes', 'playlist-motorista');
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return [];
  const dados = snapshot.data();
  return dados.musicas || [];
}
