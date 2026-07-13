/**
 * Pega a localização atual do motorista via navegador.
 * Retorna uma Promise com { lat, lng } ou lança erro se negado/indisponível.
 */
export function obterLocalizacaoAtual() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não é suportada neste dispositivo.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicao) => {
        resolve({
          lat: posicao.coords.latitude,
          lng: posicao.coords.longitude,
        });
      },
      (erro) => {
        reject(erro);
      },
      {
        // Sem exigir alta precisão: usa triangulação de rede/wifi quando o GPS
        // demora ou está fraco (ex: dentro de casa). Menos exato, mas muito mais confiável.
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 5 * 60 * 1000, // aceita uma localização de até 5 min atrás, evita nova espera
      }
    );
  });
}