/**
 * Script de correção única: procura empresas duplicadas na coleção "banners"
 * (mesmo nome, ignorando maiúscula/minúscula e acento — ex: "Auto Posto
 * gatão" e "Auto Posto Gatão" contam como a mesma empresa) e une tudo num
 * único documento, mesclando os campos preenchidos.
 *
 * Prioridade de qual documento SOBREVIVE (vira o principal): o que já tem
 * imagem/categoria de carrossel (pra não quebrar nenhum banner que já
 * aparece no site). Os campos que faltarem nele (descricao, whatsapp,
 * instagram, link, categorias) são completados com o que tiver nos outros
 * duplicados. Depois, os duplicados extras são apagados.
 *
 * MODO SIMULAÇÃO POR PADRÃO: com APLICAR_MUDANCAS = false, o script só
 * MOSTRA o que faria (nenhum dado é alterado ou apagado). Depois de
 * conferir o log e ver que está tudo certo, troque para true e rode de
 * novo pra aplicar de verdade.
 *
 * COMO USAR:
 *   node scripts/unificar-banners-duplicados.cjs
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

function normalizarNome(nome) {
  return (nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Pontua o quão "completo" está um documento, pra decidir qual sobrevive. */
function pontuarCompletude(dados) {
  let pontos = 0;
  if (dados.categorias && dados.categorias.length > 0) pontos += 3;
  if (dados.imagemUrl) pontos += 3;
  if (dados.descricao) pontos += 1;
  if (dados.whatsapp) pontos += 1;
  if (dados.instagram) pontos += 1;
  if (dados.link) pontos += 1;
  return pontos;
}

async function main() {
  const snapshot = await db.collection('banners').get();

  const grupos = new Map(); // nomeNormalizado -> [{ id, dados }]
  snapshot.docs.forEach((doc) => {
    const dados = doc.data();
    const nome = normalizarNome(dados.empresaNome);
    if (!nome) return;
    if (!grupos.has(nome)) grupos.set(nome, []);
    grupos.get(nome).push({ id: doc.id, dados });
  });

  const duplicados = [...grupos.values()].filter((grupo) => grupo.length > 1);

  console.log(`Total de empresas distintas: ${grupos.size}`);
  console.log(`Grupos com duplicata: ${duplicados.length}`);
  console.log(`Modo: ${APLICAR_MUDANCAS ? '⚠️  APLICANDO MUDANÇAS DE VERDADE' : '🔎 SIMULAÇÃO (nada será alterado)'}\n`);

  for (const grupo of duplicados) {
    const ordenado = [...grupo].sort((a, b) => pontuarCompletude(b.dados) - pontuarCompletude(a.dados));
    const principal = ordenado[0];
    const extras = ordenado.slice(1);

    const mesclado = { ...principal.dados };
    const camposSimples = ['descricao', 'whatsapp', 'instagram', 'link', 'imagemUrl', 'empresaNome'];

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
    }

    console.log(`— "${principal.dados.empresaNome}" —`);
    console.log(`   Fica: ${principal.id}`);
    console.log(`   Apaga: ${extras.map((e) => e.id).join(', ')}`);

    if (APLICAR_MUDANCAS) {
      await db.collection('banners').doc(principal.id).set(mesclado, { merge: false });
      for (const extra of extras) {
        await db.collection('banners').doc(extra.id).delete();
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
  console.error('❌ Erro ao unificar banners duplicados:', erro);
  process.exit(1);
});
