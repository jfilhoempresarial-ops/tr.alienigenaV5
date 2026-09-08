/**
 * Sincroniza a aba "Prestadores" (planilha "arquivos_nuvem_tra", a mesma
 * usada pra avaliações/cotações/newsletter) com a coleção "empresas" do
 * Firestore. SUBSTITUI o antigo scripts/importar-empresas.cjs, que lia um
 * arquivo prestadores.xlsx local em vez de uma planilha do Google.
 *
 * COMO EDITAR PRESTADORES A PARTIR DE AGORA:
 *   Direto na aba "Prestadores" da planilha, pelo celular ou computador —
 *   não precisa mais mexer em arquivo nenhum no GitHub/VS Code pra isso.
 *
 *   - A planilha pode ter a MESMA empresa repetida em várias linhas, uma
 *     pra cada Setor em que ela atende (ex: "Guiauto Serviços e Peças"
 *     aparece como Mecânico, Elétrica, Guincho e Auto Peças). O script
 *     agrupa todas as linhas de uma mesma empresa+cidade num único
 *     documento, com os setores juntados no campo "setores" (array).
 *   - Adicionar linha(s) nova(s) = a empresa aparece no site.
 *   - Editar uma célula (telefone, endereço, etc.) = atualiza no site.
 *   - Apagar TODAS as linhas de uma empresa = ela é removida do site.
 *   - A coluna "Palavras-chave" (separadas por vírgula) alimenta o campo
 *     "palavrasChave" (array) no Firestore, pra facilitar a busca no site.
 *
 * PROTEÇÃO CONTRA PERDA DE DADOS: toda empresa que vem desta planilha
 * recebe a marca origem="planilha-prestadores". O script só remove do
 * Firestore quem tem ESSA marca e saiu da planilha — nunca mexe em
 * cadastros feitos direto pelo site ("Cadastrar minha empresa") ou
 * aprovados manualmente pelo admin, mesmo que eles não apareçam aqui.
 *
 * SEGURO RODAR DE NOVO: cada empresa recebe um ID fixo — slug de
 * "nome cidade" (mesmo formato do script antigo, pra preservar o
 * histórico de avaliações já vinculado a essas empresas). Campos vazios
 * na planilha (endereço, telefone, lat/long etc.) NÃO apagam o que já
 * existia no Firestore pra aquele campo — só atualiza o que veio
 * preenchido. Isso é de propósito: se no futuro alguém capturar a
 * localização (GPS) direto pelo celular no site, essa sincronização não
 * vai sobrescrever com um campo vazio da planilha.
 *
 * COMO USAR:
 *   node scripts/sincronizar-prestadores.cjs
 */

const { google } = require('googleapis');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = require('path').join(__dirname, 'serviceAccountKey.json');
const PLANILHA_ID = '1csMdl7mts1mTZTF7BcZskjdPdIqYwnHmbXAlsRaAggg';
const ABA = 'Prestadores'; // <-- confirme se é esse o nome exato da aba na planilha
const CABECALHO = [
  'Setor',
  'Empresa',
  'Descrição dos Serviços',
  'Endereço',
  'Telefone/Whatssap',
  'Cidade',
  'Estado',
  'Latitude/Longitude',
  'Cadastrado por',
  'Palavras-chave',
];
const COLLECTION = 'empresas';
const ORIGEM = 'planilha-prestadores';

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
    range: `${ABA}!A:J`,
    valueInputOption: 'RAW',
    requestBody: { values: [CABECALHO] },
  });
}

function normalizarTelefone(valor) {
  if (!valor) return '';
  return valor.toString().replace(/\D/g, '');
}

/** Mesmo gerador de ID do antigo importar-empresas.cjs — precisa ser idêntico,
 * pra não "perder" o histórico de avaliações das empresas já cadastradas. */
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

function lerPalavrasChave(valor) {
  if (!valor) return [];
  return valor
    .toString()
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Deixa o "Setor" só com letras minúsculas sem acento, pra comparar sem se
 * importar com maiúscula/acentuação/hífen (ex: "Lava-Jato" -> "lavajato"). */
function normalizarSetor(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]+/g, '');
}

/** "Setor" (coluna da planilha, texto em português) -> código da categoria
 * usado pelas páginas do site (mesmo código dos botões da home, em
 * src/pages/home.js) — é isso que buscarEmpresasPorCategoria() usa pra
 * filtrar no Firestore (campo "categorias"). Setores sem categoria
 * correspondente aqui (ex: Funilaria, Retífica) continuam salvos em
 * "setores" e aparecem na busca geral — só não têm página de categoria
 * própria ainda no site. */
const CATEGORIA_POR_SETOR = {
  mecanico: 'mecanico',
  eletrica: 'eletrica',
  borracharia: 'borracharia',
  guincho: 'guincho',
  guinchosocorro: 'guincho',
  lavajato: 'lavajato',
  tacografo: 'tacografo',
  autopecas: 'autopecas',
  postodecombustivel: 'posto',
  postoconveniencia: 'posto',
  pontodeapoio: 'pontoapoio',
  ppdsantt: 'pontoapoio',
  outrosservicos: 'financiamento',
};

/** Agrupa as linhas da planilha por empresa+cidade (uma empresa pode ter
 * várias linhas, uma por setor em que atende). */
function montarEmpresasDaPlanilha(linhas) {
  const empresasPorChave = new Map();
  let puladas = 0;

  linhas.forEach((linha, indice) => {
    const [setor, nomeBruto, descricao, endereco, telefone, cidade, estado, latLng, cadastradoPor, palavrasChave] =
      linha;
    const nome = (nomeBruto || '').trim();

    if (!nome) {
      if (linha.some((v) => v)) console.warn(`Linha ${indice + 2} ignorada: sem nome de empresa.`);
      puladas++;
      return;
    }

    const cidadeTratada = (cidade || '').trim();
    const chave = gerarIdEmpresa(nome, cidadeTratada);

    if (!empresasPorChave.has(chave)) {
      const { lat, lng } = lerLatLng(latLng);
      empresasPorChave.set(chave, {
        id: chave,
        nome,
        cidade: cidadeTratada,
        estado: (estado || '').trim(),
        endereco: (endereco || '').trim(),
        whatsapp: normalizarTelefone(telefone),
        descricao: (descricao || '').trim(),
        cadastradoPor: (cadastradoPor || '').trim() || null,
        palavrasChave: lerPalavrasChave(palavrasChave),
        lat,
        lng,
        setores: [],
        categorias: [],
      });
    }

    const empresa = empresasPorChave.get(chave);
    const setorTratado = (setor || '').trim();
    if (setorTratado && !empresa.setores.includes(setorTratado)) {
      empresa.setores.push(setorTratado);
    }
    // Converte o Setor (texto em português) pro código de categoria que as
    // páginas do site usam pra filtrar (ex: "Lava-Jato" -> "lavajato").
    const categoriaCorrespondente = CATEGORIA_POR_SETOR[normalizarSetor(setorTratado)];
    if (categoriaCorrespondente && !empresa.categorias.includes(categoriaCorrespondente)) {
      empresa.categorias.push(categoriaCorrespondente);
    }
    // Se essa linha específica tiver descrição/palavras-chave e a empresa
    // ainda não tiver pego nenhuma (primeira linha vazia nesse campo), usa.
    const descricaoLinha = (descricao || '').trim();
    if (!empresa.descricao && descricaoLinha) empresa.descricao = descricaoLinha;
  });

  return { empresas: [...empresasPorChave.values()], puladas };
}

async function main() {
  const sheets = await autenticarGoogleSheets();
  await garantirAba(sheets);

  const resposta = await sheets.spreadsheets.values.get({
    spreadsheetId: PLANILHA_ID,
    range: `${ABA}!A:J`,
  });
  const linhasAtuais = resposta.data.values || [];
  const temCabecalho = linhasAtuais.length > 0 && linhasAtuais[0][0] === CABECALHO[0];
  const linhasDeDados = temCabecalho ? linhasAtuais.slice(1) : linhasAtuais;

  console.log(`Total de linhas na planilha: ${linhasDeDados.length}`);

  const { empresas, puladas } = montarEmpresasDaPlanilha(linhasDeDados);

  if (empresas.length === 0) {
    console.warn('⚠️  Nenhuma empresa válida encontrada na planilha. Por segurança, nada foi alterado no Firestore.');
    return;
  }

  const idsDaPlanilha = new Set(empresas.map((e) => e.id));

  // Só considera remover quem tem a marca desta planilha — nunca mexe em
  // empresas cadastradas de outro jeito (site, admin, etc.).
  const snapshot = await db.collection(COLLECTION).where('origem', '==', ORIGEM).get();
  const idsParaRemover = snapshot.docs.map((doc) => doc.id).filter((id) => !idsDaPlanilha.has(id));

  if (idsParaRemover.length > 0) {
    console.log(`🗑️  Removendo ${idsParaRemover.length} empresa(s) que saíram da planilha:`);
    idsParaRemover.forEach((id) => console.log(`   - ${id}`));
    const batchDelete = db.batch();
    idsParaRemover.forEach((id) => batchDelete.delete(db.collection(COLLECTION).doc(id)));
    await batchDelete.commit();
  }

  // Cria/atualiza as empresas da planilha. merge:true preserva campos que
  // não vêm da planilha (avaliações, notaMedia, totalAvaliacoes, uma
  // eventual localização capturada por GPS no futuro, etc.).
  const batchUpsert = db.batch();
  let semCoordenada = 0;
  empresas.forEach(({ id, lat, lng, ...dados }) => {
    const ref = db.collection(COLLECTION).doc(id);
    const dadosParaGravar = {
      ...dados,
      origem: ORIGEM,
      ativo: true,
      verificado: true,
      atualizadoEm: new Date().toISOString(),
    };
    // Só grava lat/lng se a planilha realmente tiver esse dado — célula
    // vazia não apaga uma coordenada que já exista no Firestore.
    if (lat !== null && lng !== null) {
      dadosParaGravar.lat = lat;
      dadosParaGravar.lng = lng;
    } else {
      semCoordenada++;
    }
    batchUpsert.set(ref, dadosParaGravar, { merge: true });
  });
  await batchUpsert.commit();

  console.log(`\n✅ ${empresas.length} empresa(s) sincronizada(s) com sucesso na coleção "${COLLECTION}".`);
  console.log(`   ${puladas} linha(s) pulada(s) (sem nome preenchido).`);
  console.log(`   ${idsParaRemover.length} empresa(s) removida(s) por não estarem na planilha.`);
  if (semCoordenada > 0) {
    console.log(`   ⚠️  ${semCoordenada} empresa(s) sem Latitude/Longitude preenchida na planilha.`);
  }
}

main().catch((erro) => {
  console.error('❌ Erro ao sincronizar prestadores:', erro);
  process.exit(1);
});
