/**
 * Script de importação: lê o CSV de prestadores de serviço
 * (scripts/prestadores.csv) e cadastra cada linha COMPLETA na
 * coleção "empresas" do Firestore.
 *
 * Uma linha só é importada se tiver: Setor, Empresa, Endereço e
 * Telefone/Whatssap preenchidos. Linhas faltando qualquer um desses
 * são ignoradas (ficam na planilha como "pendente de completar").
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

// Se true, as empresas já entram como aprovadas (aparecem no site na hora).
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

async function main() {
  const conteudoCsv = fs.readFileSync(CAMINHO_CSV, 'utf-8');
  const linhas = parse(conteudoCsv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // Agrupa por nome da empresa (uma empresa pode aparecer 2x com setores diferentes)
  const empresasPorNome = new Map();
  let puladas = 0;

  for (const linha of linhas) {
    const nome = linha['Empresa'];
    const endereco = linha['Endereço'];
    const setor = linha['Setor'];
    const telefone = linha['Telefone/Whatssap'];

    // Linha "completa" exige os 4 campos principais preenchidos.
    // O que não estiver completo fica pra você terminar de preencher depois.
    if (!setor || !nome || !endereco || !telefone) {
      puladas++;
      continue;
    }

    const categoria = mapearCategoria(setor);
    if (!categoria) {
      console.warn(`⚠️  Setor não mapeado: "${setor}" (empresa: ${nome}) — pulando categoria, mas mantendo empresa.`);
    }

    const chave = nome.trim().toLowerCase();
    if (!empresasPorNome.has(chave)) {
      empresasPorNome.set(chave, {
        nome: nome.trim(),
        whatsapp: normalizarTelefone(telefone),
        endereco: endereco.trim(),
        cidade: (linha['Cidade'] || '').trim(),
        estado: (linha['Estado'] || '').trim(),
        latLng: parseLatLng(linha['Latitude/Longitude']),
        categorias: new Set(),
      });
    }
    if (categoria) {
      empresasPorNome.get(chave).categorias.add(categoria);
    }
  }

  console.log(`\nTotal de empresas únicas encontradas: ${empresasPorNome.size}`);
  console.log(`Linhas puladas (incompletas): ${puladas}\n`);

  let enviadas = 0;
  let comCoordenadas = 0;

  for (const empresa of empresasPorNome.values()) {
    const dados = {
      nome: empresa.nome,
      whatsapp: empresa.whatsapp,
      endereco: `${empresa.endereco}${empresa.cidade ? ' - ' + empresa.cidade : ''}${empresa.estado ? '/' + empresa.estado : ''}`,
      categorias: Array.from(empresa.categorias),
      verificado: MARCAR_COMO_VERIFICADO,
      criadoEm: new Date().toISOString(),
      origem: 'importacao-csv',
    };

    if (empresa.latLng) {
      dados.lat = empresa.latLng.lat;
      dados.lng = empresa.latLng.lng;
      comCoordenadas++;
    }

    await db.collection('empresas').add(dados);
    enviadas++;
    console.log(
      `✅ (${enviadas}) ${dados.nome} — categorias: [${dados.categorias.join(', ') || 'nenhuma'}]${
        empresa.latLng ? ' — com coordenadas' : ''
      }`
    );
  }

  console.log(`\n🎉 Concluído! ${enviadas} empresas cadastradas no Firestore.`);
  console.log(`   ${comCoordenadas} já entraram com lat/lng da planilha.`);
  console.log(`   ${enviadas - comCoordenadas} vão precisar do geocodificar-empresas.cjs.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});
