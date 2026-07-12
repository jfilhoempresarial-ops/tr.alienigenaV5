/** Formata uma data ISO (ex: "2026-08-15") para o formato brasileiro por extenso. */
export function formatarDataEvento(dataIso) {
  const data = new Date(`${dataIso}T00:00:00`);
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
