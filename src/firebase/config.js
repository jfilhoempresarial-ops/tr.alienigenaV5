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

// experimentalAutoDetectLongPolling: detecta automaticamente quando a conexão
// em streaming (WebChannel) padrão do Firestore está sendo bloqueada — comum
// em redes de operadora móvel/proxies restritivos — e troca para long polling
// nesses casos, sem prejudicar a performance em redes normais (Wi-Fi, etc).
// Isso resolve o site "carregando pra sempre" em alguns celulares (ex: iPhone
// em 4G/5G) sem precisar forçar long polling o tempo todo.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
});

export const auth = getAuth(app);