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

/** Distância de edição (Levenshtein) entre duas palavras — quanto menor,
 * mais parecidas são. Usada pra tolerar erro de digitação (1-2 letras
 * trocadas/faltando) na busca. */
function distanciaEdicao(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let linhaAnterior = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const linhaAtual = [i];
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      linhaAtual[j] = Math.min(
        linhaAnterior[j] + 1, // remoção
        linhaAtual[j - 1] + 1, // inserção
        linhaAnterior[j - 1] + custo // substituição
      );
    }
    linhaAnterior = linhaAtual;
  }
  return linhaAnterior[n];
}

/** Quantos erros de digitação tolerar, de acordo com o tamanho da palavra
 * (palavra curta tolera menos, senão vira "achar tudo"). */
function tolerancia(tamanho) {
  if (tamanho <= 4) return 1;
  return 2;
}

/** Separa um texto corrido em palavras individuais (pra comparar cada
 * palavra do texto com o termo digitado, não o texto inteiro de uma vez). */
function palavrasDoTexto(texto) {
  return normalizar(texto)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** true se o token digitado aparece (exato OU com erro de digitação
 * tolerável) em algum lugar do texto completo. */
function tokenBateNoTexto(token, textoCompleto, palavrasTexto) {
  if (textoCompleto.includes(token)) return true;
  const limiar = tolerancia(token.length);
  return palavrasTexto.some((palavra) => Math.abs(palavra.length - token.length) <= limiar && distanciaEdicao(token, palavra) <= limiar);
}

export const LABEL_CATEGORIA = {
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
    const palavrasTexto = palavrasDoTexto(textoCompleto);

    // "Borracharia em Sobral" vira ["borracharia", "sobral"] — a empresa
    // só aparece se TODAS as palavras relevantes baterem em algum campo dela
    // (categoria, nome, endereço, cidade ou palavras-chave do cadastro).
    // Cada palavra bate por igualdade OU por estar perto o suficiente de
    // alguma palavra do texto (tolera 1-2 letras erradas/faltando).
    if (tokens.length > 0) {
      return tokens.every((token) => tokenBateNoTexto(token, textoCompleto, palavrasTexto));
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

  const total = empresas.length + vagas.length + fretes.length + grupos.length + aniversariantes.length;
  const sugestoes = total === 0 ? gerarSugestoes(tokens, todasEmpresas) : [];

  return { empresas, vagas, fretes, grupos, aniversariantes, sugestoes };
}

/** Quando a busca não acha nada, sugere palavras-chave/nomes parecidos com o
 * que a pessoa digitou, pra ela poder clicar em vez de tentar adivinhar de
 * novo. Só entra em ação quando o resultado deu zero — não pesa na busca
 * normal do dia a dia. */
function gerarSugestoes(tokens, todasEmpresas) {
  if (tokens.length === 0) return [];

  const vocabulario = new Set();
  todasEmpresas.forEach((e) => {
    const categoriasLabel = (e.categorias || []).map((c) => LABEL_CATEGORIA[c] || c);
    [e.nome, ...categoriasLabel, ...(e.palavrasChave || [])].forEach((texto) => {
      palavrasDoTexto(texto).forEach((palavra) => {
        if (palavra.length > 2) vocabulario.add(palavra);
      });
    });
  });

  const candidatas = [];
  tokens.forEach((token) => {
    vocabulario.forEach((palavra) => {
      if (Math.abs(palavra.length - token.length) > 3) return; // muito diferente de tamanho, nem tenta
      const dist = distanciaEdicao(token, palavra);
      if (dist > 0 && dist <= 3) candidatas.push({ palavra, dist });
    });
  });

  candidatas.sort((a, b) => a.dist - b.dist);

  const vistas = new Set();
  const sugestoes = [];
  for (const { palavra } of candidatas) {
    if (vistas.has(palavra)) continue;
    vistas.add(palavra);
    sugestoes.push(palavra);
    if (sugestoes.length >= 5) break;
  }
  return sugestoes;
}