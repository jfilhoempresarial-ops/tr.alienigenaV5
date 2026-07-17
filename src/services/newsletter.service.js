import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config.js';

const COLLECTION = 'newsletter';

/** Cadastra um novo inscrito na newsletter. */
export async function cadastrarNewsletter(nome, email) {
  const ref = collection(db, COLLECTION);
  await addDoc(ref, {
    nome: nome.trim(),
    email: email.trim().toLowerCase(),
    criadoEm: serverTimestamp(),
  });
}
