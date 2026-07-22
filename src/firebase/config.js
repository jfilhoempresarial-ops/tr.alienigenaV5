import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Todas as chaves vêm do .env (nunca hardcoded aqui).
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(firebaseConfig);

// experimentalForceLongPolling: antes usávamos experimentalAutoDetectLongPolling
// (detecção automática), mas mesmo assim dois motoristas em redes móveis de
// rodovia continuaram travando na conexão com o Firestore ("Buscando
// prestadores..." pra sempre, sem erro). O modo automático nem sempre detecta
// a tempo redes que bloqueiam o streaming (WebChannel). Forçando long polling
// sempre, a conexão fica um pouco mais pesada em redes boas (Wi-Fi, 4G forte),
// mas funciona de forma confiável em qualquer rede — prioridade certa pra um
// app que precisa funcionar na estrada, com qualquer sinal.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export const auth = getAuth(app);