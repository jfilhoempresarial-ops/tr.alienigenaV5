/**
 * Serviço de fretes.
 *
 * POR ENQUANTO: retorna dados de EXEMPLO (fixos no código), só para
 * a tela funcionar visualmente enquanto não importamos o CSV real de fretes.
 *
 * QUANDO FOR IMPLEMENTAR DE VERDADE: troque o conteúdo desta função para
 * buscar do Firestore (mesmo padrão usado em vagas.service.js e
 * empresas.service.js), mantendo os MESMOS NOMES DE CAMPO usados aqui
 * (tipoVeiculo, origem, destino, km, volume) — assim a tela que já
 * existe continua funcionando sem precisar mexer em mais nada.
 */
export async function buscarFretesDestaque(quantidade = 3) {
  const exemplos = [
    { tipoVeiculo: 'Truck', origem: 'Sobral', destino: 'Tianguá', km: 85, volume: 14200 },
    { tipoVeiculo: 'Carreta Toco', origem: 'Sobral', destino: 'Ipu', km: 133, volume: 22860 },
    { tipoVeiculo: 'Bitrem', origem: 'Sobral', destino: 'São Benedito', km: 126, volume: 38060 },
    { tipoVeiculo: 'Rodotrem 48T', origem: 'Sobral', destino: 'Brejo Santo', km: 624, volume: 48900 },
  ];
  return exemplos.slice(0, quantidade);
}

