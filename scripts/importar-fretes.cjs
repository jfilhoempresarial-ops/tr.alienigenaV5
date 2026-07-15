/**
 * Script de importação: lê a planilha de cargas/fretes (recebida
 * diariamente) e cadastra cada combinação de veículo+carroceria como um
 * documento separado na coleção "fretes" do Firestore.
 *
 * Filtra automaticamente para trazer só fretes com ORIGEM no Ceará
 * (cidade termina em " - CE" na planilha).
 *
 * COMO USAR:
 * 1. Coloque este arquivo dentro da pasta "scripts/" do projeto.
 * 2. Instale a biblioteca necessária (só precisa fazer isso UMA VEZ):
 *      npm install xlsx
 * 3. Coloque a planilha recebida dentro de "scripts/", com o nome
 *    "cargas.xlsx" (mesmo formato de sempre: Origem, Destino, Carga,
 *    Espécie, Exige Rastreamento, Veículo, Carroceria, Preço,
 *    Peso (ton), Obs.).
 * 4. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/importar-fretes.cjs
 *
 * Este script LIMPA a coleção antiga e sobe a lista nova por completo —
 * rode sempre que receber uma planilha atualizada.
 */

const path = require('path');
const XLSX = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_PLANILHA = path.join(__dirname, 'cargas.xlsx');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
});
const db = getFirestore();

function dividirLista(campo) {
  if (!campo) return [];
  return campo
    .toString()
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function dividirCidadeEstado(campo) {
  const partes = (campo || '').toString().split(' - ');
  if (partes.length < 2) return { cidade: campo || '', estado: '' };
  const estado = partes.pop().trim();
  const cidade = partes.join(' - ').trim();
  return { cidade, estado };
}

async function limparColecao() {
  const snapshot = await db.collection('fretes').get();
  if (snapshot.empty) return;
  console.log(`🗑️  Removendo ${snapshot.size} fretes antigos...`);
  const lotes = [];
  let lote = db.batch();
  let contador = 0;
  snapshot.docs.forEach((doc) => {
    lote.delete(doc.ref);
    contador++;
    if (contador === 400) {
      lotes.push(lote.commit());
      lote = db.batch();
      contador = 0;
    }