import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../firebase/config.js';

const provedorGoogle = new GoogleAuthProvider();

export async function fazerLogin(email, senha) {
  const resultado = await signInWithEmailAndPassword(auth, email, senha);
  return resultado.user;
}

/**
 * Login público com Google — usado pelo motorista pra poder avaliar uma
 * empresa (nome e foto vêm direto da conta Google dele). Diferente do
 * login de e-mail/senha usado só na área /admin.
 */
export async function fazerLoginGoogle() {
  const resultado = await signInWithPopup(auth, provedorGoogle);
  return resultado.user;
}

export async function fazerLogout() {
  await signOut(auth);
}

/** Chama o callback sempre que o estado de login mudar (logado/deslogado). */
export function observarAutenticacao(callback) {
  return onAuthStateChanged(auth, callback);
}

/** Usuário logado agora, se tiver (leitura síncrona, sem esperar callback). */
export function usuarioAtual() {
  return auth.currentUser;
}
