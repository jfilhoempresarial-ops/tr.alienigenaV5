/**
 * Script de LIMPEZA (rodar só uma vez): encontra empresas duplicadas no
 * Firestore — o mesmo nome + cidade cadastrado várias vezes (isso aconteceu
 * porque, antes do importar-empresas.cjs usar um ID fixo, cada execução do
 * script criava registros novos em vez de atualizar os existentes).
 *
 * Pra cada grupo de duplicadas, o script:
 * 1. Escolhe a "melhor" cópia (a que tem mais informação preenchida,
 *    como avaliações já recebidas).
 * 2. Salva essa cópia com o ID fixo correto (nome+cidade), do jeito que o
 *    importar-empresas.cjs espera encontrar da próxima vez.
 * 3. Apaga todas as outras cópias duplicadas.
 *
 * COMO USAR:
 *   node scripts/limpar-empresas-duplicadas.cjs
 *
 * Por segurança, ele primeiro faz um "modo teste" (não apaga nada, só
 * mostra o que faria). Depois de conferir o resultado, rode de novo com
 * a flag --confirmar pra executar de verdade:
 *   node scripts/limpar-empresas-duplicadas.cjs --confirmar
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');
const MODO_CONFIRMAR = process.argv.includes('--confirmar');

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
});
const db = getFirestore();

/** Mesmo gerador de ID usado no importar-empresas.cjs — precisa ser idêntico. */
function gerarIdEmpresa(nome, cidade) {
  const texto = `${nome} ${cidade || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return texto || `empresa-${Date.now()}`;
}

function normalizarChave(nome, cidade) {
  const texto = `${nome} ${cidade || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return texto;
}

/** Escolhe a cópia mais "completa" entre as duplicadas. */
function escolherMelhor(docs) {
  return docs.reduce((melhor, atual) => {
    const pontosMelhor = pontuar(melhor.data());
    const pontosAtual = pontuar(atual.data());
    return pontosAtual > pontosMelhor ? atual : melhor;
  });
}

function pontuar(dados) {
  let pontos = 0;
  if (dados.totalAvaliacoes) pontos += dados.totalAvaliacoes * 10; // preserva avaliações acima de tudo
  if (dados.lat && dados.lng) pontos += 5;
  if (dados.cidade) pontos += 2;
  if (dados.whatsapp) pontos += 1;
  if (dados.endereco) pontos += 1;
  return pontos;
}

async function main() {
  const snapshot = await db.collection('empresas').get();
  console.log(`Total de empresas no Firestore: ${snapshot.size}\n`);

  // Agrupa por nome+cidade normalizado
  const grupos = new Map();
  snapshot.docs.forEach((doc) => {
    const dados = doc.data();
    const chave = normalizarChave(dados.nome, dados.cidade);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(doc);
  });

  const duplicados = [...grupos.values()].filter((docs) => docs.length > 1);

  if (duplicados.length === 0) {
    console.log('✅ Nenhuma empresa duplicada encontrada. Nada a fazer.');
    return;
  }

  console.log(`⚠️  Encontrados ${duplicados.length} grupo(s) de empresas duplicadas:\n`);

  let totalApagar = 0;

  for (const grupo of duplicados) {
    const melhor = escolherMelhor(grupo);
    const dadosMelhor = melhor.data();
    const idCorreto = gerarIdEmpresa(dadosMelhor.nome, dadosMelhor.cidade);
    const outros = grupo.filter((d) => d.id !== melhor.id);

    console.log(`📍 "${dadosMelhor.nome}" (${dadosMelhor.cidade || 'sem cidade'}) — ${grupo.length} cópias encontradas`);
    console.log(`   Mantendo: ${melhor.id} → vai virar: ${idCorreto}`);
    console.log(`   Apagando: ${outros.map((d) => d.id).join(', ')}`);
    totalApagar += outros.length;

    if (MODO_CONFIRMAR) {
      // Salva a melhor cópia com o ID fixo correto (cria novo doc se o ID mudar)
      if (melhor.id !== idCorreto) {
        await db.collection('empresas').doc(idCorreto).set(dadosMelhor);
        await melhor.ref.delete();
      }
      // Apaga as outras cópias duplicadas
      for (const doc of outros) {
        await doc.ref.delete();
      }
    }
    console.log('');
  }

  if (MODO_CONFIRMAR) {
    console.log(`🎉 Concluído! ${totalApagar} cópia(s) duplicada(s) removida(s).`);
  } else {
    console.log(`\n🔎 Isso foi um MODO TESTE — nada foi apagado ainda.`);
    console.log(`   ${totalApagar} cópia(s) seriam removidas.`);
    console.log(`   Se estiver tudo certo, rode de novo com:`);
    console.log(`   node scripts/limpar-empresas-duplicadas.cjs --confirmar`);
  }
}

main().catch((erro) => {
  console.error('❌ Erro:', erro);
  process.exit(1);
});
