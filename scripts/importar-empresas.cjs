/**
 * Script de importação: lê o CSV de prestadores de serviço
 * (scripts/prestadores.csv) e cadastra/atualiza cada linha COMPLETA
 * na coleção "empresas" do Firestore.
 *
 * Uma linha só é importada se tiver: Setor, Empresa, Endereço e
 * Telefone/Whatssap preenchidos. Linhas faltando qualquer um desses
 * são ignoradas (ficam na planilha como "pendente de completar").
 *
 * SEGURO RODAR DE NOVO: cada empresa recebe um ID fixo (gerado a
 * partir do nome + cidade), então rodar o script de novo com a
 * planilha atualizada ATUALIZA a empresa já existente em vez de
 * duplicar. Campos que não vêm da planilha (avaliações, notaMedia,
 * totalAvaliacoes) são preservados.
 *
 * Se a coluna "Latitude/Longitude" já vier preenchida (formato
 * "lat, lng"), o script já salva lat/lng direto — sem precisar
 * rodar o geocodificar-empresas.cjs pra essas.
 *
 * COMO USAR:
 * 1. Atualize o scripts/prestadores.csv com as novas informações.
 * 2. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/importar-empresas.cjs
 * 3. Depois, se quiser preencher lat/lng das que ficaram sem, rode:
 *      node scripts/geocodificar-empresas.cjs
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// ---------- CONFIGURAÇÃO ----------
const CAMINHO_CSV = path.join(__dirname, 'prestadores.csv');
const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

// Se true, as empresas já entram/continuam como aprovadas (aparecem no site na hora).
// Se false, entram pendentes (precisam ser aprovadas no painel admin).
const MARCAR_COMO_VERIFICADO = true;

// Mapeia o texto do "Setor" da planilha para o código de categoria do site.
const MAPA_CATEGORIAS = {
  'Mecânico': 'mecanico',
  'Guincho': 'guincho',
  'Borracharia': 'borracharia',
  'Elétrica': 'eletrica',
  'Lava-Jato': 'lavajato',
  'Posto de Combustível': 'posto',
  'Posto de Combu': 'posto', // caso a coluna venha cortada
  'Auto Peças': 'autopecas',
  'Tacógrafo': 'tacografo',
  'Ponto de Apoio': 'pontoapoio',
  'Pontos de Apoio': 'pontoapoio', // aceita as duas formas (singular/plural) na planilha
};
// -----------------------------------

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
});
const db = getFirestore();

function normalizarTelefone(telefone) {
  if (!telefone) return '';
  return telefone.toString().replace(/\D/g, '');
}

function mapearCategoria(setor) {
  const chave = (setor || '').trim();
  return MAPA_CATEGORIAS[chave] || null;
}

/** Converte "lat, lng" (string da coluna Latitude/Longitude) em { lat, lng } numéricos. */
function parseLatLng(texto) {
  if (!texto || !texto.trim()) return null;
  const partes = texto.split(',').map((p) => parseFloat(p.trim()));
  if (partes.length !== 2 || partes.some((n) => Number.isNaN(n))) return null;
  return { lat: partes[0], lng: partes[1] };
}

/** Gera um ID de documento estável a partir do nome + cidade (evita duplicar em reimportações). */
function gerarIdEmpresa(nome, cidade) {
  const texto = `${nome} ${cidade || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return texto || `empresa-${Date.now()}`;
}

async function main() {
  const conteudoCsv = fs.readFileSync(CAMINHO_CSV, 'utf-8');
  const linhas = parse(conteudoCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Agrupa por nome+cidade da empresa (uma empresa pode aparecer 2x com setores diferentes)
  const empresasPorId = new Map();
  let puladas = 0;

  for (const linha of linhas) {
    const nome = linha['Empresa'];
    const endereco = linha['Endereço'];
    const setor = linha['Setor'];
    const telefone = linha['Telefone/Whatssap'];
    const cidade = (linha['Cidade'] || '').trim();

    // Linha "completa" exige Setor, Empresa e Endereço preenchidos. Telefone
    // NÃO é mais obrigatório — algumas empresas legítimas (postos de rede
    // grande, PPDs, etc.) não têm telefone público disponível, e isso não
    // deve impedir o cadastro. O card só esconde o botão de WhatsApp quando
    // não houver telefone (ver card-empresa.js).
    if (!setor || !nome || !endereco) {
      puladas++;
      continue;
    }

    const categoria = mapearCategoria(setor);
    if (!categoria) {
      console.warn(`⚠️  Setor não mapeado: "${setor}" (empresa: ${nome}) — pulando categoria, mas mantendo empresa.`);
    }

    const id = gerarIdEmpresa(nome, cidade);
    if (!empresasPorId.has(id)) {
      empresasPorId.set(id, {
        id,
        nome: nome.trim(),
        whatsapp: normalizarTelefone(telefone),
        endereco: endereco.trim(),
        cidade,
        estado: (linha['Estado'] || '').trim(),
        latLng: parseLatLng(linha['Latitude/Longitude']),
        categorias: new Set(),
      });
    }
    if (categoria) {
      empresasPorId.get(id).categorias.add(categoria);
    }
  }

  console.log(`\nTotal de empresas únicas encontradas: ${empresasPorId.size}`);
  console.log(`Linhas puladas (incompletas): ${puladas}\n`);

  let novas = 0;
  let atualizadas = 0;
  let comCoordenadas = 0;

  for (const empresa of empresasPorId.values()) {
    const dados = {
      nome: empresa.nome,
      whatsapp: empresa.whatsapp,
      endereco: `${empresa.endereco}${empresa.cidade ? ' - ' + empresa.cidade : ''}${empresa.estado ? '/' + empresa.estado : ''}`,
      cidade: empresa.cidade || '',
      categorias: Array.from(empresa.categorias),
      verificado: MARCAR_COMO_VERIFICADO,
      origem: 'importacao-csv',
    };

    if (empresa.latLng) {
      dados.lat = empresa.latLng.lat;
      dados.lng = empresa.latLng.lng;
      comCoordenadas++;
    }

    const docRef = db.collection('empresas').doc(empresa.id);
    const existente = await docRef.get();

    if (existente.exists) {
      // merge: true preserva campos que não vêm da planilha, como
      // notaMedia/totalAvaliacoes (avaliações já feitas pelos motoristas).
      await docRef.set(dados, { merge: true });
      atualizadas++;
      console.log(`🔄 (${atualizadas + novas}) ${dados.nome} — atualizada`);
    } else {
      await docRef.set({ ...dados, criadoEm: new Date().toISOString() });
      novas++;
      console.log(`✅ (${atualizadas + novas}) ${dados.nome} — nova`);
    }
  }

  console.log(`\n🎉 Concluído!`);
  console.log(`   ${novas} empresas novas.`);
  console.log(`   ${atualizadas} empresas já existentes, atualizadas.`);
  console.log(`   ${comCoordenadas} entraram/atualizaram com lat/lng da planilha.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});
