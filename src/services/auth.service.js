import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/config.js';

export async function fazerLogin(email, senha) {
  const resultado = await signInWithEmailAndPassword(auth, email, senha);
  return resultado.user;
}

export async function fazerLogout() {
  await signOut(auth);
}

/** Chama o callback sempre que o estado de login mudar (logado/deslogado). */
export function observarAutenticacao(callback) {
  return onAuthStateChanged(auth, callback);
}
