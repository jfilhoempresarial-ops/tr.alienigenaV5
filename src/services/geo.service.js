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
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
