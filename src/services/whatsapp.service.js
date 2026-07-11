import { apenasDigitos } from '../utils/formatters.js';

/**
 * Monta um link wa.me pronto, com mensagem pré-preenchida.
 */
export function gerarLinkWhatsapp(numero, mensagem = '') {
  const digits = apenasDigitos(numero);
  const numeroComDDI = digits.startsWith('55') ? digits : `55${digits}`;
  const texto = encodeURIComponent(mensagem);
  return `https://wa.me/${numeroComDDI}${texto ? `?text=${texto}` : ''}`;
}
