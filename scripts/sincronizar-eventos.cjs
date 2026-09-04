/**
 * Script de sincronização: lê scripts/eventos.json e faz a coleção
 * "eventos" do Firestore refletir esse arquivo — igual a planilha de
 * empresas e a de grupos de WhatsApp.
 *
 * DIFERENÇA IMPORTANTE: eventos com "data" no passado (antes de hoje) são
 * automaticamente IGNORADOS e removidos do Firestore, mesmo que ainda
 * estejam escritos no eventos.json. Assim, o evento some sozinho do site
 * no dia seguinte, sem precisar editar o arquivo pra tirá-lo — você só
 * remove a linha do JSON quando quiser, sem pressa, e enquanto isso o robô
 * já esconde do site automaticamente.
 *
 * Roda todo dia sozinho via GitHub Actions (não precisa editar nada pra
 * isso acontecer — é só o tempo passar) E também sempre que você editar e
 * salvar o eventos.json (ver .github/workflows/atualizar-eventos.yml).
 *
 * EDIÇÃO PELO CELULAR: abra scripts/eventos.json no site/app do GitHub,
 * toque no lápis de editar, adicione ou remova um bloco { ... } dentro dos
 * colchetes, e salve direto no navegador do celular — não precisa de
 * computador nem terminal. Cada evento é um bloco assim:
 *   {
 *     "titulo": "Nome do evento",
 *     "data": "AAAA-MM-DD",
 *     "local": "Cidade/UF",
 *     "descricao": "Texto livre",
 *     "link": "",
 *     "imagemUrl": "/images/eventos/nome-do-arquivo.jpg"
 *   }
 * Não esqueça da vírgula entre um bloco e outro se tiver mais de um evento.
 *
 * COMO USAR (manual, se precisar forçar fora do horário programado):
 *   node scripts/sincronizar-eventos.cjs
 */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const COLLECTION = 'eventos';
const CAMINHO_JSON = path.join(__dirname, 'eventos.json');
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

/** Retorna true se a data (AAAA-MM-DD) já passou, comparando com o dia de hoje (sem hora). */
function jaPassou(dataStr) {
  const partes = String(dataStr || '').split('-');
  if (partes.length !== 3) return true; // data inválida/vazia: trata como vencida, não mostra
  const [ano, mes, dia] = partes.map(Number);
  const dataEvento = new Date(ano, mes - 1, dia);
  if (isNaN(dataEvento.getTime())) return true;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return dataEvento.getTime() < hoje.getTime();
}

async function sincronizar() {
  if (!fs.existsSync(CAMINHO_JSON)) {
    console.error(`❌ Não encontrei o arquivo ${CAMINHO_JSON}`);
    process.exit(1);
  }

  let eventosBrutos;
  try {
    const conteudo = fs.readFileSync(CAMINHO_JSON, 'utf-8');
    eventosBrutos = JSON.parse(conteudo);
  } catch (erro) {
    console.error('❌ eventos.json com erro de sintaxe (vírgula faltando, aspas erradas, etc).');
    console.error('   Por segurança, nada foi alterado no Firestore. Corrija o arquivo e rode de novo.');
    console.error('   Detalhe do erro:', erro.message);
    process.exit(1);
  }

  if (!Array.isArray(eventosBrutos)) {
    console.error('❌ eventos.json precisa ser uma lista [ ] de eventos. Nada foi alterado.');
    process.exit(1);
  }

  const eventosValidos = eventosBrutos.filter((e) => e && e.titulo && e.data);
  const eventosAtuais = eventosValidos.filter((e) => !jaPassou(e.data));
  const eventosVencidos = eventosValidos.filter((e) => jaPassou(e.data));

  console.log(`Total de eventos no arquivo: ${eventosValidos.length}`);
  console.log(`  Válidos (hoje ou no futuro): ${eventosAtuais.length}`);
  console.log(`  Vencidos (não vão aparecer no site): ${eventosVencidos.length}`);
  if (eventosVencidos.length > 0) {
    eventosVencidos.forEach((e) => console.log(`    - ${e.titulo} (${e.data})`));
  }
  console.log('');

  // Apaga a coleção inteira e recria só com os eventos válidos — mais simples
  // que tentar casar IDs, e como não há nada externo referenciando um evento
  // específico (ao contrário de empresas, que podem ter avaliações), não tem
  // risco de perder dado nenhum fazendo assim.
  const snapshot = await db.collection(COLLECTION).get();
  if (!snapshot.empty) {
    const batchDelete = db.batch();
    snapshot.docs.forEach((doc) => batchDelete.delete(doc.ref));
    await batchDelete.commit();
  }

  if (eventosAtuais.length === 0) {
    console.log('⚠️  Nenhum evento válido pra publicar. A coleção "eventos" ficou vazia.');
    return;
  }

  const batchCriar = db.batch();
  eventosAtuais.forEach((evento) => {
    const ref = db.collection(COLLECTION).doc();
    batchCriar.set(ref, {
      titulo: evento.titulo,
      data: evento.data,
      local: evento.local || '',
      detalhes: Array.isArray(evento.detalhes) ? evento.detalhes : [],
      descricao: evento.descricao || '', // mantido por compatibilidade com eventos antigos sem "detalhes"
      link: evento.link || null,
      imagemUrl: evento.imagemUrl || null,
      ativo: true,
      atualizadoEm: new Date().toISOString(),
    });
  });
  await batchCriar.commit();

  console.log(`✅ ${eventosAtuais.length} evento(s) publicado(s) no site.`);
}

sincronizar().catch((erro) => {
  console.error('❌ Erro ao sincronizar eventos:', erro);
  process.exit(1);
});
