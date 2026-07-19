import { buscarTodasEmpresas } from './empresas.service.js';
import { buscarVagas } from './vagas.service.js';
import { buscarTodosFretes } from './fretes.service.js';
import { buscarGruposWhatsappAtivos } from './grupos-whatsapp.service.js';
import { buscarAniversariantesDaSemana } from './aniversariantes.service.js';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const LABEL_CATEGORIA = {
  mecanico: 'Mecânico',
  posto: 'Posto Conveniência',
  borracharia: 'Borracharia',
  eletrica: 'Elétrica',
  guincho: 'Guincho Socorro',
  pontoapoio: 'Ponto de Apoio',
  autopecas: 'Auto Peças',
  lavajato: 'Lava-Jato',
  tacografo: 'Tacógrafo',
};

// Palavras pequenas/comuns que a gente ignora ao separar a busca em partes
// (ex: "borracharia EM sobral" -> ["borracharia", "sobral"], ignorando "em").
const STOPWORDS_BUSCA = new Set([
  'em', 'de', 'do', 'da', 'dos', 'das', 'para', 'pra', 'com', 'e', 'a', 'o',
  'os', 'as', 'um', 'uma', 'no', 'na', 'nos', 'nas', 'por', 'que', 'perto',
  'aqui', 'algum', 'alguma', 'preciso', 'quero', 'procuro',
]);

/** Separa o termo digitado em palavras relevantes (ignora conectivos curtos). */
function tokenizar(termo) {
  return normalizar(termo)
    .split(/[^a-z0-9]+/)
    .filter((palavra) => palavra.length > 2 && !STOPWORDS_BUSCA.has(palavra));
}

/**
 * Busca global: procura o termo digitado em empresas, vagas, fretes,
 * grupos de WhatsApp e aniversariantes da semana, tudo de uma vez.
 */
export async function buscarNoSite(termo) {
  const qn = normalizar(termo);
  if (!qn) {
    return { empresas: [], vagas: [], fretes: [], grupos: [], aniversariantes: [] };
  }

  const tokens = tokenizar(termo);

  const [empresasR, vagasR, fretesR, gruposR, aniversariantesR] = await Promise.allSettled([
    buscarTodasEmpresas(),
    buscarVagas(),
    buscarTodosFretes(),
    buscarGruposWhatsappAtivos(),
    buscarAniversariantesDaSemana(),
  ]);

  const todasEmpresas = empresasR.status === 'fulfilled' ? empresasR.value : [];
  const empresas = todasEmpresas.filter((e) => {
    const categoriasLabel = (e.categorias || []).map((c) => LABEL_CATEGORIA[c] || c);
    const textoCompleto = normalizar(
      [e.nome, e.endereco, e.cidade, ...categoriasLabel, ...(e.palavrasChave || [])].join(' ')
    );

    // "Borracharia em Sobral" vira ["borracharia", "sobral"] — a empresa
    // só aparece se TODAS as palavras relevantes baterem em algum campo dela
    // (categoria, nome, endereço, cidade ou palavras-chave do cadastro).
    if (tokens.length > 0) {
      return tokens.every((token) => textoCompleto.includes(token));
    }
    // Termo era só conectivos/muito curto: cai no modo antigo, busca a frase inteira.
    return textoCompleto.includes(qn);
  });

  const todasVagas = vagasR.status === 'fulfilled' ? vagasR.value.itens || [] : [];
  const vagas = todasVagas.filter(
    (v) => normalizar(v.cargo).includes(qn) || normalizar(v.cidade).includes(qn)
  );

  const todosFretes = fretesR.status === 'fulfilled' ? fretesR.value : [];
  const fretes = todosFretes.filter(
    (f) =>
      normalizar(f.veiculo).includes(qn) ||
      normalizar(f.carroceria).includes(qn) ||
      normalizar(f.carga).includes(qn) ||
      normalizar(f.cidadeOrigem).includes(qn) ||
      normalizar(f.cidadeDestino).includes(qn)
  );

  const todosGrupos = gruposR.status === 'fulfilled' ? gruposR.value : [];
  const grupos = todosGrupos.filter(
    (g) => normalizar(g.nomeGrupo).includes(qn) || normalizar(g.cidade).includes(qn)
  );

  const todosAniversariantes = aniversariantesR.status === 'fulfilled' ? aniversariantesR.value : [];
  const aniversariantes = todosAniversariantes.filter((a) => normalizar(a.nome).includes(qn));

  return { empresas, vagas, fretes, grupos, aniversariantes };
}