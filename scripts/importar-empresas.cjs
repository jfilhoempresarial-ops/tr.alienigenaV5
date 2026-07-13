/**
 * Script de importação: lê um CSV de prestadores de serviço
 * e cadastra cada um na coleção "empresas" do Firestore.
 *
 * COMO USAR:
 * 1. Coloque este arquivo dentro da pasta "scripts/" do projeto.
 * 2. Coloque seu CSV exportado (Google Sheets > Arquivo > Download > CSV)
 *    também dentro de "scripts/", com o nome "prestadores.csv".
 * 3. No terminal, dentro da pasta do projeto, rode:
 *      npm install firebase-admin csv-parse
 *      node scripts/importar-empresas.js
 *
 * O script mostra no terminal cada empresa que está subindo,
 * e um resumo no final (quantas subiram, quantas foram puladas).
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

    if (!nome || !endereco) {
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
        whatsapp: normalizarTelefone(linha['Telefone']),
        endereco: endereco.trim(),
        cidade: (linha['Cidade'] || '').trim(),
        estado: (linha['Estado'] || '').trim(),
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

    await db.collection('empresas').add(dados);
    enviadas++;
    console.log(`✅ (${enviadas}) ${dados.nome} — categorias: [${dados.categorias.join(', ') || 'nenhuma'}]`);
  }

  console.log(`\n🎉 Concluído! ${enviadas} empresas cadastradas no Firestore.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});
