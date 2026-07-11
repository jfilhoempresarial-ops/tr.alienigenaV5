/**
 * Calcula distância em km entre dois pontos usando a fórmula de Haversine.
 */
export function calcularDistanciaKm(lat1, lng1, lat2, lng2) {
  const R = 6371; // raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(graus) {
  return (graus * Math.PI) / 180;
}

/** Ordena uma lista de empresas por distância até um ponto de referência. */
export function ordenarPorDistancia(empresas, origemLat, origemLng) {
  return [...empresas]
    .map((empresa) => ({
      ...empresa,
      distanciaKm: calcularDistanciaKm(
        origemLat,
        origemLng,
        empresa.location.lat,
        empresa.location.lng
      ),
    }))
    .sort((a, b) => a.distanciaKm - b.distanciaKm);
}
