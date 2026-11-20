/**
 * Filtro de cargos de TRANSPORTE E LOGÍSTICA, usado pelos dois robôs de vagas:
 *  - buscar-vagas-idt.cjs   (Vagas do SINE)
 *  - buscar-outras-vagas.cjs (Outras vagas: Jooble + Vagas Indicadas)
 * Mexendo aqui, muda nos dois.
 */

function normalizar(txt) {
  return String(txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// QUAIS VAGAS ENTRAM NO SITE (Transporte e Logística)
// Tudo é comparado sem acento e sem diferença de maiúscula/minúscula.
// Basta o nome do cargo CONTER um dos termos abaixo.
// Para acrescentar um cargo novo, é só colocar mais um termo na lista certa.
// ---------------------------------------------------------------------------

// Motoristas e transporte de cargas
// (motorista de caminhão, carreteiro, entregador, categoria D/E, ônibus...)
const TERMOS_MOTORISTA = [
  'motorista', 'caminhao', 'caminhoes', 'caminhoneiro', 'carreta', 'carreteiro',
  'cacambeiro', 'bitrem', 'basculante', 'guincho', 'manobrador', 'manobrista',
  'onibus', 'condutor',
];

// Carga, descarga, estoque, almoxarifado e expedição
const TERMOS_ARMAZEM = [
  'ajudante de motorista', 'ajudante de carga', 'ajudante de descarga',
  'carga e descarga', 'cargas e descargas', 'carregador e descarregador', 'carregador de',
  'auxiliar de carga', 'auxiliar de descarga',
  'almoxarif',           // almoxarife, auxiliar de almoxarifado
  'estoquista', 'estoque', // estoquista, líder de estoque, auxiliar de estoque
  'conferente',          // conferente de mercadorias / de carga
  'separador de pedido', 'separador de mercadoria', 'separador de carga', 'separador de material',
  'expedicao', 'expedidor', // auxiliar e líder de expedição, expedidor de mercadorias
  'empilhadeira',
  'operador de balancas rodoviarias',
];

// Logística, transportes, tráfego e frota (do auxiliar ao coordenador)
const TERMOS_GESTAO = [
  'logistica',           // auxiliar, assistente, analista, encarregado, supervisor, coordenador
  'transporte',          // auxiliar, assistente, analista, fiscal, programador de transporte(s)
  'roteirizador', 'roteirizacao',
  'programador de carga',
  'controlador de trafego', 'trafego de veiculos',
  'frota',               // monitor, assistente, encarregado de frota
];

// Máquinas pesadas e içamento
const TERMOS_MAQUINAS = [
  'empilhadeira', 'pa carregadeira', 'carregadeira',
  'retroescavadeira', 'retro escavadeira', 'retro-escavadeira', 'operador de retro',
  'escavadeira', 'motoniveladora', 'rolo compactador', 'operador de trator',
  'munck', 'munk', 'guindaste', 'guindauto',
];

// Manutenção: só entra se for de veículo PESADO
// (mecânico de veículos pesados, eletricista de caminhão...)
const OFICIOS_MANUTENCAO = ['mecanico', 'eletricista', 'auxiliar de mecanico'];
const SINAIS_DE_PESADO = ['pesad', 'caminh', 'diesel', 'onibus', 'carreta', 'rodoviari', 'frota', 'maquinas pesadas'];

// Borracheiro entra sempre (no SINE quase sempre vem só "Borracheiro", sem dizer se é de caminhão)
const TERMOS_BORRACHARIA = ['borracheiro', 'borracharia'];

// "Operador de máquina(s)" é muito genérico: tem vaga de fábrica de doces,
// de corte de pedra, de costura... Só entra se for máquina PESADA / de obra / de estrada.
const OPERADOR_MAQUINA_PESADA = [
  'construcao', 'terraplenagem', 'pesad', 'rodoviari', 'mineracao',
  'escavadeira', 'retro', 'motoniveladora', 'carregadeira', 'rolo compactador',
  'trator', 'guindaste', 'munck', 'munk', 'pavimentacao', 'empilhadeira',
];

// Cargos que NUNCA entram, mesmo tendo um termo das listas acima.
const EXCLUIR = [
  // Moto não tem a ver com o público do site
  'motofret', 'moto-fret', 'moto fret', 'motoboy', 'moto boy', 'mototaxi', 'moto-taxi', 'moto taxi',
  'motocicl', 'motoqueiro', 'motoentreg',
  // "transporte" e "condutor" pegam coisas fora da área
  'transporte escolar', 'monitor de transporte', 'condutor de turismo', 'condutor ambiental',
  'transporte de pacientes', 'maqueiro',
];

const TERMOS_TRANSPORTE_LOGISTICA = [
  ...TERMOS_MOTORISTA, ...TERMOS_ARMAZEM, ...TERMOS_GESTAO, ...TERMOS_MAQUINAS, ...TERMOS_BORRACHARIA,
];

/** Decide se o cargo é de Transporte e Logística (tudo comparado sem acento). */
function ehVagaDeTransporte(cargo) {
  const c = normalizar(cargo);
  if (EXCLUIR.some((p) => c.includes(normalizar(p)))) return false;

  if (c.includes('operador de maquina')) {
    return OPERADOR_MAQUINA_PESADA.some((p) => c.includes(p));
  }

  if (OFICIOS_MANUTENCAO.some((p) => c.includes(p))) {
    return SINAIS_DE_PESADO.some((p) => c.includes(p));
  }

  return TERMOS_TRANSPORTE_LOGISTICA.some((p) => c.includes(normalizar(p)));
}

module.exports = { ehVagaDeTransporte, normalizarTexto: normalizar };
