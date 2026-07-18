export function formatarDistancia(km) {
  if (km === null || km === undefined || Number.isNaN(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

export function formatarTelefone(numero) {
  const digits = numero.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return numero;
}

export function apenasDigitos(texto) {
  return texto.replace(/\D/g, '');
}

/** Formata uma data ISO (ex: "2026-08-15") para o formato brasileiro por extenso. */
export function formatarDataEvento(dataIso) {
  const data = new Date(`${dataIso}T00:00:00`);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}