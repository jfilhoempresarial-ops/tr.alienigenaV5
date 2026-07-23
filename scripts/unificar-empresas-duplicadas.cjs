/**
 * Script de correção única: procura empresas duplicadas na coleção "empresas"
 * (mesmo nome + mesma cidade, ignorando maiúscula/minúscula e acento) e une
 * tudo num único documento, mesclando os campos preenchidos e as categorias.
 *
 * Isso resolve duplicatas que sobraram de importações antigas, onde a mesma
 * empresa acabou gravada duas vezes com IDs diferentes (por alguma diferença
 * de formatação entre execuções do importar-empresas.cjs ao longo do tempo).
 *
 * Prioridade de qual documento SOBREVIVE (vira o principal): o mais completo
 * — mais categorias, tem lat/lng, tem whatsapp, tem avaliações já registradas
 * (notaMedia/totalAvaliacoes), pra não perder histórico de avaliação dos
 * motoristas. As categorias de TODOS os duplicados são somadas (união), não
 * substituídas — se uma cópia tinha "tacografo" e outra "mecanico", o
 * resultado final tem as duas.
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
  // Agrupa por nome + endereço (não por "cidade"): o campo cidade pode estar
  // vazio ou ausente em documentos gravados por versões antigas do script
  // de importação, o que faria duplicatas reais passarem despercebidas.
  // O endereço é sempre preenchido, então é uma chave mais confiável.
  return `${normalizarTexto(dados.nome)}|${normalizarTexto(dados.endereco)}`;
}

/** Pontua o quão "completo"/importante é um documento, pra decidir qual sobrevive. */
function pontuarCompletude(dados) {
  let pontos = 0;
  if (dados.totalAvaliacoes) pontos += 5; // NUNCA perder avaliações já feitas por motoristas
  if (dados.lat && dados.lng) pontos += 2;
  if (dados.whatsapp) pontos += 2;
  if ((dados.categorias || []).length > 0) pontos += 1;
  if (dados.criadoEm) pontos += 1;
  return pontos;
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

  console.log(`Total de empresas distintas (por nome+endereço): ${grupos.size}`);
  console.log(`Grupos com duplicata: ${duplicados.length}`);
  console.log(`Modo: ${APLICAR_MUDANCAS ? '⚠️  APLICANDO MUDANÇAS DE VERDADE' : '🔎 SIMULAÇÃO (nada será alterado)'}\n`);

  for (const grupo of duplicados) {
    const ordenado = [...grupo].sort((a, b) => pontuarCompletude(b.dados) - pontuarCompletude(a.dados));
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
