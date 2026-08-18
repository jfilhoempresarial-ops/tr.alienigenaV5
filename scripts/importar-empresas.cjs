// scripts/importar-grupos-whatsapp.cjs
//
// Lê scripts/relacao_grupos.xlsx e sincroniza os grupos com a coleção
// "grupos_whatsapp" no Firestore. Roda via GitHub Actions
// (.github/workflows/atualizar-grupos-whatsapp.yml), 2x por dia e sempre
// que a planilha for alterada.
//
// A cada execução, a coleção inteira é apagada e reescrita com o conteúdo
// atual da planilha — assim, basta adicionar/editar/remover uma linha no
// relacao_grupos.xlsx que o site reflete isso na próxima sincronização.
// Não é necessário controlar duplicados manualmente.

const path = require('path');
const xlsx = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const COLLECTION = 'grupos_whatsapp';
const PLANILHA = path.join(__dirname, 'relacao_grupos.xlsx');

function iniciarFirebase() {
  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64) {
    throw new Error('Variável FIREBASE_SERVICE_ACCOUNT_BASE64 não definida.');
  }
  const serviceAccount = JSON.parse(
    Buffer.from(base64, 'base64').toString('utf-8')
  );
  const app = initializeApp({ credential: cert(serviceAccount) });
  return getFirestore(app);
}

function normalizarTelefone(valor) {
  const digitos = String(valor || '').replace(/\D/g, '');
  if (!digitos) return '';
  // Garante o prefixo do país (55). Se a planilha já tiver o 55 na frente
  // (13 dígitos), não duplica.
  return digitos.startsWith('55') && digitos.length >= 12
    ? digitos
    : `55${digitos}`;
}

function normalizarCidade(valor) {
  const cidade = String(valor || '').trim();
  if (!cidade) return '';
  return cidade.includes('/') ? cidade : `${cidade}/CE`;
}

function lerPlanilha() {
  const workbook = xlsx.readFile(PLANILHA);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const linhas = xlsx.utils.sheet_to_json(sheet, { defval: '' });

  return linhas
    .map((linha, indice) => {
      const nomeGrupo = String(linha.Grupo || '').trim();
      const responsavel = String(linha.Adm || '').trim();
      const whatsapp = normalizarTelefone(linha.Telefone);

      if (!nomeGrupo || !responsavel || !whatsapp) {
        console.warn(
          `Linha ${indice + 2} ignorada por dados incompletos:`,
          linha
        );
        return null;
      }

      return {
        nomeGrupo,
        cidade: normalizarCidade(linha.Cidade),
        categoria: String(linha.Categoria || '').trim(),
        responsavel,
        whatsapp,
        isExemplo: false,
        ativo: true,
        ordem: indice + 1,
        atualizadoEm: new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

async function limparColecao(db) {
  const snapshot = await db.collection(COLLECTION).get();
  if (snapshot.empty) return;

  const batches = [];
  let batch = db.batch();
  let contador = 0;

  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
    contador += 1;
    if (contador === 450) {
      batches.push(batch.commit());
      batch = db.batch();
      contador = 0;
    }
  });
  if (contador > 0) batches.push(batch.commit());

  await Promise.all(batches);
}

async function importar() {
  const db = iniciarFirebase();
  const grupos = lerPlanilha();

  if (grupos.length === 0) {
    console.warn('Nenhum grupo válido encontrado na planilha. Nada foi alterado no Firestore.');
    return;
  }

  await limparColecao(db);

  const batch = db.batch();
  grupos.forEach((grupo) => {
    const ref = db.collection(COLLECTION).doc();
    batch.set(ref, grupo);
  });
  await batch.commit();

  console.log(`${grupos.length} grupo(s) importado(s) com sucesso para "${COLLECTION}".`);
}

importar().catch((erro) => {
  console.error('Erro ao importar grupos de WhatsApp:', erro);
  process.exit(1);
});
