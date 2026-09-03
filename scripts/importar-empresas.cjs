/**
 * Script de sincronização: lê scripts/prestadores.xlsx e faz a coleção
 * "empresas" do Firestore refletir EXATAMENTE o que está na planilha —
 * essa é a única fonte de verdade pra empresas/prestadores no site.
 *
 * Isso significa que qualquer empresa que exista no Firestore mas NÃO
 * esteja na planilha é REMOVIDA automaticamente (por exemplo, cadastros
 * feitos direto pelo site via "Cadastrar minha empresa", ou lixo de testes
 * antigos). Se quiser que uma empresa apareça no site, ela precisa estar
 * na planilha — não tem outro caminho.
 *
 * A planilha pode ter a MESMA empresa repetida em várias linhas, uma pra
 * cada Setor em que ela atende (ex: "Guiauto Serviços e Peças" aparece
 * como Mecânico, Elétrica, Guincho e Auto Peças). Esse script agrupa
 * todas as linhas de uma mesma empresa+cidade num único documento, com
 * os setores juntados no campo "setores" (array).
 *
 * SEGURO RODAR DE NOVO: cada empresa recebe um ID fixo — slug de
 * "nome cidade" (mesmo formato usado por scripts/limpar-empresas-duplicadas.cjs).
 * Empresas que continuam na planilha são atualizadas com merge:true, o que
 * preserva campos que não vêm da planilha (como avaliações cadastradas
 * manualmente/pelos clientes). Só documentos cujo ID não corresponde a
 * NENHUMA empresa da planilha atual são apagados.
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

function montarEmpresasDaPlanilha(linhas) {
  const empresasPorChave = new Map();
  let puladas = 0;

  linhas.forEach((linha, indice) => {
    const nome = String(linha['Empresa'] || '').trim();
    const cidade = String(linha['Cidade'] || '').trim();
    const setor = String(linha['Setor'] || '').trim();
    const cadastradoPor = String(linha['Cadastrado por'] || '').trim();

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
        cadastradoPor: cadastradoPor || null,
        lat,
        lng,
        setores: [],
      });
    }

    const empresa = empresasPorChave.get(chave);
    if (setor && !empresa.setores.includes(setor)) {
      empresa.setores.push(setor);
    }
    const descricaoLinha = String(linha['Descrição dos Serviços'] || '').trim();
    if (!empresa.descricao && descricaoLinha) {
      empresa.descricao = descricaoLinha;
    }
  });

  return { empresas: [...empresasPorChave.values()], puladas };
}

async function sincronizar() {
  if (!fs.existsSync(CAMINHO_PLANILHA)) {
    console.error(`❌ Não encontrei o arquivo ${CAMINHO_PLANILHA}`);
    process.exit(1);
  }

  const linhas = lerPlanilha();
  console.log(`\nTotal de linhas na planilha: ${linhas.length}\n`);

  const { empresas, puladas } = montarEmpresasDaPlanilha(linhas);

  if (empresas.length === 0) {
    console.warn('⚠️  Nenhuma empresa válida encontrada na planilha. Por segurança, nada foi alterado no Firestore.');
    return;
  }

  const idsDaPlanilha = new Set(empresas.map((e) => e.id));

  // Busca tudo que já existe no Firestore pra descobrir o que precisa ser removido.
  const snapshot = await db.collection(COLLECTION).get();
  const idsParaRemover = snapshot.docs
    .map((doc) => doc.id)
    .filter((id) => !idsDaPlanilha.has(id));

  // Remove empresas que não estão mais (ou nunca estiveram) na planilha.
  if (idsParaRemover.length > 0) {
    console.log(`🗑️  Removendo ${idsParaRemover.length} empresa(s) que não estão na planilha:`);
    idsParaRemover.forEach((id) => console.log(`   - ${id}`));

    const batchDelete = db.batch();
    idsParaRemover.forEach((id) => {
      batchDelete.delete(db.collection(COLLECTION).doc(id));
    });
    await batchDelete.commit();
  }

  // Cria/atualiza as empresas da planilha (merge preserva avaliações etc.).
  const batchUpsert = db.batch();
  empresas.forEach(({ id, ...dados }) => {
    const ref = db.collection(COLLECTION).doc(id);
    batchUpsert.set(
      ref,
      { ...dados, ativo: true, atualizadoEm: new Date().toISOString() },
      { merge: true }
    );
  });
  await batchUpsert.commit();

  console.log(`\n✅ ${empresas.length} empresa(s) sincronizada(s) com sucesso na coleção "${COLLECTION}".`);
  console.log(`   ${puladas} linha(s) pulada(s) (sem nome preenchido).`);
  console.log(`   ${idsParaRemover.length} empresa(s) removida(s) por não estarem na planilha.`);
}

sincronizar().catch((erro) => {
  console.error('❌ Erro ao sincronizar empresas:', erro);
  process.exit(1);
});
