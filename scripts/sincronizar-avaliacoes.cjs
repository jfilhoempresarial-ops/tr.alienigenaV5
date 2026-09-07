/**
 * Sincroniza as avaliações (Firestore) com uma aba "Avaliações" na mesma
 * Google Planilha da newsletter — nos DOIS sentidos:
 *
 *   1) Avaliação nova no site → vira uma linha nova na planilha.
 *   2) Linha apagada na planilha → a avaliação é REMOVIDA do site
 *      (some da nota média da empresa e da lista de "últimas avaliações").
 *
 * COMO EXCLUIR UMA AVALIAÇÃO:
 *   Simplesmente apaga a LINHA INTEIRA na aba "Avaliações" (botão direito no
 *   número da linha → "Excluir linha"). Na próxima sincronização, ela some
 *   do site. NÃO edite a coluna A (ID) de uma linha existente — se fizer
 *   isso, o robô não vai mais reconhecer aquela linha e pode duplicar ou
 *   ignorar ela.
 *
 * A coluna A (ID) é só de controle interno — pode deixar oculta/estreita,
 * não precisa mexer nela pra nada além de excluir a linha toda.
 *
 * CONFIGURAÇÃO: usa a mesma planilha e a mesma conta de serviço já
 * configuradas em sincronizar-newsletter.cjs. Se a aba "Avaliações" ainda
 * não existir na planilha, o script cria ela sozinho na primeira vez.
 *
 * COMO USAR:
 *   node scripts/sincronizar-avaliacoes.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
const PLANILHA_ID = '192gf5Sg6ViGDcoxDdUCQmm6cWsGUDpLwpc87KwBtX5s';
const ABA = 'Avaliações';
const CABECALHO = ['ID (não editar)', 'Empresa', 'Nota', 'Comentário', 'Avaliador', 'Data'];

function carregarCredencial() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const json = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf-8');
    return JSON.parse(json);
  }
  return require(CAMINHO_CHAVE);
}

const credencial = carregarCredencial();

initializeApp({
  credential: cert(credencial),
});
const db = getFirestore();

async function autenticarGoogleSheets() {
  const auth = new google.auth.JWT({
    email: credencial.client_email,
    key: credencial.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  await auth.authorize();
  return google.sheets({ version: 'v4', auth });
}

/** Cria a aba "Avaliações" se ela ainda não existir na planilha. */
async function garantirAba(sheets) {
  const planilha = await sheets.spreadsheets.get({ spreadsheetId: PLANILHA_ID });
  const jaExiste = planilha.data.sheets.some((s) => s.properties.title === ABA);
  if (jaExiste) return;

  console.log(`Aba "${ABA}" não existe ainda — criando...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: PLANILHA_ID,
    requestBody: { requests: [{ addSheet: { properties: { title: ABA } } }] },
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId: PLANILHA_ID,
    range: `${ABA}!A:F`,
    valueInputOption: 'RAW',
    requestBody: { values: [CABECALHO] },
  });
}

function formatarData(criadoEm) {
  try {
    const data = criadoEm?.toDate ? criadoEm.toDate() : new Date(criadoEm);
    if (isNaN(data.getTime())) return '';
    return data.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

async function main() {
  const sheets = await autenticarGoogleSheets();
  await garantirAba(sheets);

  // Lê o que já está na planilha AGORA (inclui as linhas que sobraram
  // depois de alguém excluir alguma).
  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILHA_ID,
    range: `${ABA}!A:F`,
  });
  const linhasAtuais = resposta.data.values || [];
  const temCabecalho = linhasAtuais.length > 0 && linhasAtuais[0][0] === CABECALHO[0];
  const linhasDeDados = temCabecalho ? linhasAtuais.slice(1) : linhasAtuais;
  const idsNaPlanilha = new Set(linhasDeDados.map((linha) => linha[0]).filter(Boolean));

  if (!temCabecalho) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA}!A:F`,
      valueInputOption: 'RAW',
      requestBody: { values: [CABECALHO] },
    });
  }

  const snapshot = await db.collection('avaliacoes').get();
  console.log(`Total de avaliações no site: ${snapshot.size}`);

  const linhasNovas = [];
  const idsParaMarcarComoSincronizadas = [];
  const idsParaExcluirDoFirestore = [];

  snapshot.docs.forEach((doc) => {
    const dados = doc.data();
    const jaFoiSincronizada = dados.sincronizadoPlanilha === true;
    const aindaEstaNaPlanilha = idsNaPlanilha.has(doc.id);

    if (jaFoiSincronizada && !aindaEstaNaPlanilha) {
      // Estava na planilha, alguém apagou a linha → remove do site também.
      idsParaExcluirDoFirestore.push(doc.id);
      return;
    }

    if (!jaFoiSincronizada) {
      // Avaliação nova, nunca apareceu na planilha ainda → adiciona.
      linhasNovas.push([
        doc.id,
        dados.empresaNome || '-',
        dados.nota ?? '-',
        dados.comentario || '',
        dados.nomeAvaliador || '-',
        formatarData(dados.criadoEm),
      ]);
      idsParaMarcarComoSincronizadas.push(doc.id);
    }
  });

  if (linhasNovas.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: PLANILHA_ID,
      range: `${ABA}!A:F`,
      valueInputOption: 'RAW',
      requestBody: { values: linhasNovas },
    });

    const batchMarcar = db.batch();
    idsParaMarcarComoSincronizadas.forEach((id) => {
      batchMarcar.update(db.collection('avaliacoes').doc(id), { sincronizadoPlanilha: true });
    });
    await batchMarcar.commit();
    console.log(`✅ ${linhasNovas.length} avaliação(ões) nova(s) adicionada(s) na planilha.`);
  }

  if (idsParaExcluirDoFirestore.length > 0) {
    // Antes de apagar a avaliação, subtrai ela da nota média da empresa.
    for (const id of idsParaExcluirDoFirestore) {
      const avaliacaoRef = db.collection('avaliacoes').doc(id);
      const avaliacaoSnap = await avaliacaoRef.get();
      const avaliacao = avaliacaoSnap.data();

      if (avaliacao?.empresaId) {
        const empresaRef = db.collection('empresas').doc(avaliacao.empresaId);
        await db.runTransaction(async (transaction) => {
          const empresaSnap = await transaction.get(empresaRef);
          if (!empresaSnap.exists) return;
          const dadosEmpresa = empresaSnap.data();
          const totalAtual = dadosEmpresa.totalAvaliacoes || 0;
          if (totalAtual <= 1) {
            transaction.update(empresaRef, { totalAvaliacoes: 0, notaMedia: 0 });
            return;
          }
          const somaAtual = (dadosEmpresa.notaMedia || 0) * totalAtual;
          const novoTotal = totalAtual - 1;
          const novaMedia = (somaAtual - avaliacao.nota) / novoTotal;
          transaction.update(empresaRef, { totalAvaliacoes: novoTotal, notaMedia: novaMedia });
        });
      }

      await avaliacaoRef.delete();
    }
    console.log(`🗑️  ${idsParaExcluirDoFirestore.length} avaliação(ões) removida(s) (linha apagada na planilha).`);
  }

  if (linhasNovas.length === 0 && idsParaExcluirDoFirestore.length === 0) {
    console.log('Nada pra sincronizar — tudo já está igual dos dois lados.');
  }
}

main().catch((erro) => {
  console.error('❌ Erro ao sincronizar avaliações:', erro);
  process.exit(1);
});
