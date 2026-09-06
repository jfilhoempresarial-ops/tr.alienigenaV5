/**
 * Script de importação: lê scripts/empresasparceiras.xlsx e sincroniza com
 * a coleção "banners" do Firestore — a mesma coleção que já alimenta os
 * carrosséis da home E a página de Empresas Parceiras.
 *
 * Empresas importadas por aqui entram SEM imagem e SEM categoria de
 * carrossel (campo "categorias" não é definido) — então elas aparecem na
 * página de Empresas Parceiras, mas não em nenhum carrossel da home, até
 * que alguém adicione uma imagem/categoria manualmente pelo admin.
 *
 * SINCRONIZAÇÃO COMPLETA: a cada execução, o script também REMOVE do
 * Firestore qualquer documento com origem: 'importacao-planilha-parceiras'
 * que não esteja mais na planilha atual — assim, tirar uma linha da
 * planilha remove a empresa do site na próxima sincronização. Só mexe em
 * documentos criados por ESTE script (identificados pela origem); banners
 * cadastrados manualmente pelo admin nunca são tocados/apagados aqui.
 *
 * SEGURO RODAR DE NOVO: cada empresa recebe um ID fixo (slug do nome), então
 * reimportar a planilha atualizada ATUALIZA a mesma empresa em vez de
 * duplicar — mas só pra empresas que já foram cadastradas por ESTE script.
 * Empresas que já tinham banner cadastrado manualmente antes (com outro ID)
 * não são afetadas.
 *
 * COMO USAR:
 *   node scripts/importar-empresas-parceiras.cjs
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_PLANILHA = path.join(__dirname, 'empresasparceiras.xlsx');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');
const ORIGEM_PARCEIRAS = 'importacao-planilha-parceiras';

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

function normalizarTelefone(telefone) {
  if (!telefone) return '';
  return telefone.toString().replace(/\D/g, '');
}

function limparInstagram(valor) {
  if (!valor) return '';
  return valor.toString().trim();
}

/** Gera um ID de documento estável a partir do nome da empresa. */
function gerarIdParceira(nome) {
  const texto = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `parceira-${texto}` || `parceira-${Date.now()}`;
}

async function main() {
  if (!fs.existsSync(CAMINHO_PLANILHA)) {
    console.error(`❌ Não encontrei o arquivo ${CAMINHO_PLANILHA}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(CAMINHO_PLANILHA);
  const primeiraAba = workbook.SheetNames[0];
  const linhas = xlsx.utils.sheet_to_json(workbook.Sheets[primeiraAba], { defval: '' });

  console.log(`\nTotal de linhas na planilha: ${linhas.length}\n`);

  let novas = 0;
  let atualizadas = 0;
  let puladas = 0;
  const idsDaPlanilha = new Set();

  for (const linha of linhas) {
    const nome = (linha['Empresa'] || '').toString().trim();
    if (!nome) {
      puladas++;
      continue;
    }

    const descricao = (linha['Solução para o motorista'] || '').toString().trim();
    const whatsapp = normalizarTelefone(linha['WhatsApp / telefone']);
    const instagram = limparInstagram(linha['Instagram']);
    const fonteLink = (linha['Fonte / link'] || '').toString().trim();

    const dados = {
      empresaNome: nome,
      descricao,
      ativo: true,
      origem: ORIGEM_PARCEIRAS,
    };
    if (whatsapp) dados.whatsapp = whatsapp;
    if (instagram) dados.instagram = instagram;
    // "link" fica só pro site/fonte genérica (ex: Motz, que só tem site, sem
    // Instagram) — o Instagram vira botão próprio no card, montado a partir
    // do campo "instagram" (handle), não precisa duplicar aqui.
    dados.link = fonteLink || null;

    const id = gerarIdParceira(nome);
    idsDaPlanilha.add(id);

    const docRef = db.collection('banners').doc(id);
    const existente = await docRef.get();

    // merge: true preserva imagemUrl/categorias caso já existam nesse
    // documento específico (não deveria existir ainda na 1ª importação,
    // mas protege reimportações futuras).
    await docRef.set(dados, { merge: true });

    if (existente.exists) {
      atualizadas++;
      console.log(`🔄 (${atualizadas + novas}) ${nome} — atualizada`);
    } else {
      novas++;
      console.log(`✅ (${atualizadas + novas}) ${nome} — nova`);
    }
  }

  // Remove do Firestore quem foi importado por este script alguma vez, mas
  // não está mais na planilha atual. Só mexe em documentos com a origem
  // certa — banners cadastrados manualmente pelo admin nunca são tocados.
  const snapshot = await db.collection('banners').where('origem', '==', ORIGEM_PARCEIRAS).get();
  const idsParaRemover = snapshot.docs.map((doc) => doc.id).filter((id) => !idsDaPlanilha.has(id));

  if (idsParaRemover.length > 0) {
    console.log(`\n🗑️  Removendo ${idsParaRemover.length} empresa(s) que saíram da planilha:`);
    idsParaRemover.forEach((id) => console.log(`   - ${id}`));

    const batch = db.batch();
    idsParaRemover.forEach((id) => batch.delete(db.collection('banners').doc(id)));
    await batch.commit();
  }

  console.log(`\n🎉 Concluído!`);
  console.log(`   ${novas} empresas novas.`);
  console.log(`   ${atualizadas} empresas já existentes (com esse ID), atualizadas.`);
  console.log(`   ${puladas} linhas puladas (sem nome preenchido).`);
  console.log(`   ${idsParaRemover.length} empresa(s) removida(s) por não estarem mais na planilha.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar empresas parceiras:', erro);
  process.exit(1);
});
