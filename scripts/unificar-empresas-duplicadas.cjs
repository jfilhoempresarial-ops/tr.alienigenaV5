/**
 * Script de correção única: procura empresas duplicadas na coleção "empresas"
 * (mesmo nome + mesma cidade, ignorando maiúscula/minúscula e acento) e une
 * tudo num único documento, mesclando os campos preenchidos e as categorias.
 *
 * Isso resolve duplicatas que sobraram de importações antigas, onde a mesma
 * empresa acabou gravada duas vezes com IDs diferentes (por alguma diferença
 * de formatação entre execuções do importar-empresas.cjs ao longo do tempo).
 *
 * Prioridade de qual documento SOBREVIVE (vira o principal): o MAIS RECENTE
 * (campo criadoEm). Documentos sem essa data são tratados como os mais
 * antigos. Mesmo escolhendo pelo mais recente, ainda mesclamos os campos que
 * faltarem nele (categorias, avaliações) a partir do(s) duplicado(s) mais
 * antigo(s), pra não perder informação à toa — só a escolha de ID/documento
 * que sobrevive muda, os dados continuam sendo somados.
 *
 * MODO SIMULAÇÃO POR PADRÃO: com APLICAR_MUDANCAS = false, o script só
 * MOSTRA o que faria (nenhum dado é alterado ou apagado). Depois de
 * conferir o log e ver que está tudo certo, troque para true e rode de
 * novo pra aplicar de verdade.
 *
 * COMO USAR:
 *   node scripts/unificar-empresas-duplicadas.cjs
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

// Troque para true depois de conferir o log da simulação.
const APLICAR_MUDANCAS = false;

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

initializeApp({
  credential: cert(carregarCredencial()),
});
const db = getFirestore();

function normalizarTexto(txt) {
  return (txt || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function chaveDuplicidade(dados) {
  // Agrupa só pelo NOME normalizado — nem "cidade" nem "endereco" são
  // confiáveis o bastante aqui: "cidade" pode estar ausente em documentos
  // antigos, e "endereco" pode ter sido digitado com redação levemente
  // diferente entre importações (ex: "R." vs "Rua"), o que fazia duplicatas
  // reais passarem despercebidas. Risco aceito: duas empresas diferentes
  // com nome IDÊNTICO em cidades diferentes se uniriam por engano — raro
  // nesse banco de dados regional, mas revise o log antes de aplicar.
  return normalizarTexto(dados.nome);
}

/** Retorna a data de criação como timestamp, ou 0 se não tiver (tratado como o mais antigo). */
function obterTimestampCriacao(dados) {
  if (!dados.criadoEm) return 0;
  const data = new Date(dados.criadoEm);
  return Number.isNaN(data.getTime()) ? 0 : data.getTime();
}

async function main() {
  const snapshot = await db.collection('empresas').get();

  const grupos = new Map(); // chave (nome+cidade normalizados) -> [{ id, dados }]
  snapshot.docs.forEach((doc) => {
    const dados = doc.data();
    const chave = chaveDuplicidade(dados);
    if (!chave || chave === '|') return;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push({ id: doc.id, dados });
  });

  const duplicados = [...grupos.values()].filter((grupo) => grupo.length > 1);

  console.log(`Total de empresas distintas (por nome): ${grupos.size}`);
  console.log(`Grupos com duplicata: ${duplicados.length}`);
  console.log(`Modo: ${APLICAR_MUDANCAS ? '⚠️  APLICANDO MUDANÇAS DE VERDADE' : '🔎 SIMULAÇÃO (nada será alterado)'}\n`);

  for (const grupo of duplicados) {
    const ordenado = [...grupo].sort((a, b) => obterTimestampCriacao(b.dados) - obterTimestampCriacao(a.dados));
    const principal = ordenado[0];
    const extras = ordenado.slice(1);

    const mesclado = { ...principal.dados };
    const camposSimples = ['whatsapp', 'endereco', 'lat', 'lng', 'nome', 'origem'];

    for (const extra of extras) {
      for (const campo of camposSimples) {
        if (!mesclado[campo] && extra.dados[campo]) {
          mesclado[campo] = extra.dados[campo];
        }
      }
      // Categorias: une os arrays, sem repetir.
      const categoriasExtra = extra.dados.categorias || [];
      const categoriasAtuais = mesclado.categorias || [];
      mesclado.categorias = [...new Set([...categoriasAtuais, ...categoriasExtra])];

      // Avaliações: soma total e recalcula a média ponderada, pra não perder
      // avaliações que os motoristas já deram em qualquer uma das cópias.
      const totalAtual = mesclado.totalAvaliacoes || 0;
      const totalExtra = extra.dados.totalAvaliacoes || 0;
      if (totalExtra > 0) {
        const somaAtual = (mesclado.notaMedia || 0) * totalAtual;
        const somaExtra = (extra.dados.notaMedia || 0) * totalExtra;
        const totalFinal = totalAtual + totalExtra;
        mesclado.totalAvaliacoes = totalFinal;
        mesclado.notaMedia = totalFinal > 0 ? (somaAtual + somaExtra) / totalFinal : 0;
      }
    }

    console.log(`— "${principal.dados.nome}" (${principal.dados.cidade}) —`);
    console.log(`   Fica: ${principal.id}`);
    console.log(`   Apaga: ${extras.map((e) => e.id).join(', ')}`);
    console.log(`   Categorias finais: ${(mesclado.categorias || []).join(', ')}`);

    if (APLICAR_MUDANCAS) {
      await db.collection('empresas').doc(principal.id).set(mesclado, { merge: false });
      for (const extra of extras) {
        await db.collection('empresas').doc(extra.id).delete();
      }
      console.log(`   ✅ Aplicado.\n`);
    } else {
      console.log(`   (simulação — nada foi alterado)\n`);
    }
  }

  console.log('🎉 Concluído!');
  if (!APLICAR_MUDANCAS) {
    console.log('\nEsse foi um teste (simulação). Confira o log acima e, se estiver tudo certo,');
    console.log('troque APLICAR_MUDANCAS para true no topo do arquivo e rode de novo pra aplicar.');
  }
}

main().catch((erro) => {
  console.error('❌ Erro ao unificar empresas duplicadas:', erro);
  process.exit(1);
});
