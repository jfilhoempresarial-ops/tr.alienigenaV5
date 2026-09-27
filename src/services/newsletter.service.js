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

// ---------------------------------------------------------------------------
// Aviso por e-mail para o Júlio quando alguém se inscreve na newsletter.
// Usa o mesmo EmailJS do formulário de cadastro, mas com um TEMPLATE próprio
// (variável VITE_EMAILJS_TEMPLATE_NEWSLETTER_ID na Vercel).
// Se o template não estiver configurado, a inscrição funciona normalmente,
// só não manda o aviso.
// ---------------------------------------------------------------------------
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_NEWSLETTER_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_NEWSLETTER_ID;
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export async function avisarNovaInscricao(nome, email) {
  if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_NEWSLETTER_ID || !EMAILJS_PUBLIC_KEY) {
    console.warn('Aviso de newsletter por e-mail não configurado (falta VITE_EMAILJS_TEMPLATE_NEWSLETTER_ID).');
    return;
  }

  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' });
  const resposta = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: EMAILJS_TEMPLATE_NEWSLETTER_ID,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        nome: nome.trim() || '-',
        email: email.trim().toLowerCase(),
        data: agora,
      },
    }),
  });

  if (!resposta.ok) {
    console.error('Falha ao enviar aviso de nova inscrição na newsletter:', await resposta.text());
  }
}
