/**
 * Converte uma nota de 0-10 em uma string de estrelas (0-5 estrelas,
 * com meia estrela quando cai no meio).
 */
export function renderEstrelas(notaMedia) {
  const notaEm5 = (notaMedia || 0) / 2;
  const cheias = Math.floor(notaEm5);
  const temMeia = notaEm5 - cheias >= 0.5;
  const vazias = 5 - cheias - (temMeia ? 1 : 0);

  return (
    '⭐'.repeat(cheias) +
    (temMeia ? '✨' : '') +
    '☆'.repeat(Math.max(vazias, 0))
  );
}

/** Retorna a nota formatada com uma casa decimal, ex: "8.5" */
export function formatarNota(notaMedia) {
  return (notaMedia || 0).toFixed(1);
}
