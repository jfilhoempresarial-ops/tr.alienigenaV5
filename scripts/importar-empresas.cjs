/**
 * Script de importação: lê scripts/prestadores.xlsx e cadastra/atualiza
 * cada empresa como um documento na coleção "empresas" do Firestore — a
 * coleção que alimenta a busca de "Empresas e serviços" no site.
 *
 * A planilha pode ter a MESMA empresa repetida em várias linhas, uma pra
 * cada Setor em que ela atende (ex: "Guiauto Serviços e Peças" aparece
 * como Mecânico, Elétrica, Guincho e Auto Peças). Esse script agrupa
 * todas as linhas de uma mesma empresa+cidade num único documento, com
 * os setores juntados no campo "setores" (array).
 *
 * SEGURO RODAR DE NOVO: cada empresa recebe um ID fixo — slug de
 * "nome cidade" (mesmo formato usado por scripts/limpar-empresas-duplicadas.cjs)
 * — então reimportar a planilha atualiza a mesma empresa em vez de duplicar.
 * O merge:true preserva campos que não vêm da planilha (como avaliações
 * cadastradas manualmente pelo admin).
 *
 * Esse script NÃO apaga empresas que saíram da planilha — só cria/atualiza.
 * Se quiser remover as que saíram, isso precisa ser um passo separado
 * (não incluído aqui de propósito, pra não apagar avaliações por engano).
 *
 * COMO USAR:
 *   node scripts/importar-empresas.cjs
 */

const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const COLLECTION = 'empresas';
const CAMINHO_PLANILHA = path.join(__dirname, 'prestadores.xlsx');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

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

function normalizarTelefone(valor) {
  if (!valor) return '';
  return valor.toString().replace(/\D/g, '');
}

/** Mesmo gerador de ID usado no scripts/limpar-empresas-duplicadas.cjs — precisa ser idêntico. */
function gerarIdEmpresa(nome, cidade) {
  const texto = `${nome} ${cidade || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return texto || `empresa-${Date.now()}`;
}

/** Lê "Latitude/Longitude" tipo "-3.703, -40.348" e separa em números. */
function lerLatLng(valor) {
  if (!valor) return { lat: null, lng: null };
  const partes = valor
    .toString()
    .split(',')
    .map((p) => parseFloat(p.trim()));
  if (partes.length !== 2 || partes.some((n) => Number.isNaN(n))) {
    return { lat: null, lng: null };
  }
  return { lat: partes[0], lng: partes[1] };
}

function lerPlanilha() {
  const workbook = xlsx.readFile(CAMINHO_PLANILHA);
  const primeiraAba = workbook.SheetNames[0];
  return xlsx.utils.sheet_to_json(workbook.Sheets[primeiraAba], { defval: '' });
}

async function importar() {
  if (!fs.existsSync(CAMINHO_PLANILHA)) {
    console.error(`❌ Não encontrei o arquivo ${CAMINHO_PLANILHA}`);
    process.exit(1);
  }

  const linhas = lerPlanilha();
  console.log(`\nTotal de linhas na planilha: ${linhas.length}\n`);

  // Agrupa as linhas por empresa (nome + cidade), juntando os setores numa lista.
  const empresasPorChave = new Map();
  let puladas = 0;

  linhas.forEach((linha, indice) => {
    const nome = String(linha['Empresa'] || '').trim();
    const cidade = String(linha['Cidade'] || '').trim();
    const setor = String(linha['Setor'] || '').trim();

    if (!nome) {
      console.warn(`Linha ${indice + 2} ignorada: sem nome de empresa.`);
      puladas++;
      return;
    }

    const chave = gerarIdEmpresa(nome, cidade);

    if (!empresasPorChave.has(chave)) {
      const { lat, lng } = lerLatLng(linha['Latitude/Longitude']);
      empresasPorChave.set(chave, {
        id: chave,
        nome,
        cidade,
        estado: String(linha['Estado'] || '').trim(),
        endereco: String(linha['Endereço'] || '').trim(),
        whatsapp: normalizarTelefone(linha['Telefone/Whatssap']),
        descricao: String(linha['Descrição dos Serviços'] || '').trim(),
        lat,
        lng,
        setores: [],
      });
    }

    const empresa = empresasPorChave.get(chave);
    if (setor && !empresa.setores.includes(setor)) {
      empresa.setores.push(setor);
    }
    // Se a descrição estava vazia na primeira linha da empresa mas essa
    // linha (de outro setor) tem descrição, aproveita.
    const descricaoLinha = String(linha['Descrição dos Serviços'] || '').trim();
    if (!empresa.descricao && descricaoLinha) {
      empresa.descricao = descricaoLinha;
    }
  });

  const empresas = [...empresasPorChave.values()];

  if (empresas.length === 0) {
    console.warn('Nenhuma empresa válida encontrada na planilha. Nada foi alterado no Firestore.');
    return;
  }

  const batch = db.batch();
  empresas.forEach(({ id, ...dados }) => {
    const ref = db.collection(COLLECTION).doc(id);
    batch.set(
      ref,
      { ...dados, ativo: true, atualizadoEm: new Date().toISOString() },
      { merge: true }
    );
  });
  await batch.commit();

  console.log(`✅ ${empresas.length} empresa(s) importada(s)/atualizada(s) com sucesso para "${COLLECTION}".`);
  console.log(`   ${puladas} linha(s) pulada(s) (sem nome preenchido).`);
}

importar().catch((erro) => {
  console.error('❌ Erro ao importar empresas:', erro);
  process.exit(1);
});