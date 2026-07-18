/**
 * Script de importação: cadastra um conjunto inicial de notícias
 * relevantes (separadas por categoria: autônomo, CLT, agregado) na
 * coleção "noticias" do Firestore.
 *
 * Diferente dos outros scripts, este usa IDs fixos (não gera IDs
 * aleatórios) — assim é seguro rodar de novo sem duplicar as notícias.
 * Para adicionar notícias novas no dia a dia, o mais prático é cadastrar
 * direto no console do Firebase (mesma coleção "noticias"), preenchendo
 * os campos: titulo, resumo, link, data (formato AAAA-MM-DD), categoria
 * ("autonomo", "clt" ou "agregado"), imagemUrl (opcional — imagem de
 * capa da notícia) e ativo (true).
 *
 * COMO USAR:
 *   node scripts/importar-noticias.cjs
 */

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
});
const db = getFirestore();

const NOTICIAS = [
  {
    id: 'diesel-gatilho-piso-frete-2026',
    titulo: 'Diesel dispara e aciona reajuste automático do frete mínimo',
    resumo: 'Com o diesel S10 na média de R$ 7,35 por litro, a ANTT acionou o gatilho legal e atualizou a tabela de piso mínimo de frete em todo o país. Agora o CIOT bloqueia automaticamente qualquer frete fechado abaixo do valor mínimo.',
    link: 'https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias/antt-atualiza-tabela-horas-apos-regulamentacao-historica-e-eleva-piso-com-base-no-diesel-a-r-7-35-reforcando-renda-e-travando-fretes-irregulares',
    imagemUrl: 'https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias/antt-atualiza-tabela-horas-apos-regulamentacao-historica-e-eleva-piso-com-base-no-diesel-a-r-7-35-reforcando-renda-e-travando-fretes-irregulares/df_tnrgo_abr2505182888.jpg/@@images/36e933b9-b9b2-4576-bd02-e2d25f49cb8b.jpeg',
    data: '2026-07-17',
    categoria: 'autonomo',
    ativo: true,
  },
  {
    id: 'adiantamento-70-frete-mp1343',
    titulo: 'Nova regra garante 70% do frete adiantado antes da viagem',
    resumo: 'A MP 1.343/2026, já aprovada na Câmara e em votação no Senado, assegura ao autônomo o adiantamento mínimo de 70% do valor do frete antes de sair para a estrada, com o restante pago em até 30 dias úteis.',
    link: 'https://targetbank.com.br/blog-do-trecho/target-log/piso-salarial-mp1343/',
    imagemUrl: 'https://targetbank.com.br/wp-content/uploads/2026/07/Header-Blog-Piso-salarial.webp',
    data: '2026-07-17',
    categoria: 'autonomo',
    ativo: true,
  },
  {
    id: 'reajuste-piso-frete-resolucao-6076',
    titulo: 'Piso mínimo de frete tem novo reajuste em 2026',
    resumo: 'A Resolução ANTT nº 6.076/2026 atualizou os coeficientes do piso mínimo de frete, com reajustes entre 0,82% e 3,15% dependendo do tipo de carga — o maior aumento ficou com o transporte de cargas perigosas.',
    link: 'https://www.transp.net/blog/posts/tabela-frete-antt-2026-resolucao-6076/',
    imagemUrl: 'https://www.transp.net/blog/posts/tabela-frete-antt-2026-resolucao-6076/images/hero.webp',
    data: '2026-07-17',
    categoria: 'autonomo',
    ativo: true,
  },
  {
    id: 'piso-salarial-clt-5mil',
    titulo: 'Câmara aprova piso salarial de R$ 5 mil para motorista CLT',
    resumo: 'O Plenário da Câmara aprovou em 17 de junho um piso salarial nacional de R$ 5.000 por mês para motoristas CLT que rodam longa distância (mais de 24h fora da base). O texto agora segue para votação no Senado.',
    link: 'https://targetbank.com.br/blog-do-trecho/target-log/piso-salarial-mp1343/',
    imagemUrl: 'https://targetbank.com.br/wp-content/uploads/2026/07/Header-Blog-Piso-salarial.webp',
    data: '2026-07-17',
    categoria: 'clt',
    ativo: true,
  },
  {
    id: 'tempo-espera-hora-extra',
    titulo: 'Tempo de espera na carga e descarga agora conta como hora extra',
    resumo: 'O STF decidiu que o tempo em que o motorista fica parado esperando carregar ou descarregar o caminhão deve ser contado como jornada de trabalho. Quem ultrapassar as 8h diárias tem direito a receber esse tempo como hora extra.',
    link: 'https://www.tst.jus.br/en/-/caminhoneiro-deve-receber-por-tempo-de-espera-com-carga-e-descarga',
    imagemUrl: 'https://www.tst.jus.br/documents/10157/2374827/Caminhoneiros+Foto+Gerv%C3%A1rio+Batista+Ag%C3%AAncia+Brasil.jpg/bbefb7b6-5bb4-d2fe-41ec-bb533e0e7352?t=1718192344216',
    data: '2026-07-17',
    categoria: 'clt',
    ativo: true,
  },
  {
    id: 'aposentadoria-motorista-stj',
    titulo: 'STJ reconhece aposentadoria mais rápida para motorista de caminhão',
    resumo: 'Pelo Tema 1307, o STJ entendeu que a atividade de motorista de caminhão de grande porte é penosa, dando direito a um bônus no tempo de contribuição para a aposentadoria — 40% a mais para homens e 20% a mais para mulheres.',
    link: 'https://grossiebessa.com.br/direitos-trabalhistas-do-motorista-de-caminhao/',
    imagemUrl: 'https://grossiebessa.com.br/wp-content/uploads/2024/12/Direito-do-motorista-insalubridade.webp',
    data: '2026-07-17',
    categoria: 'clt',
    ativo: true,
  },
  {
    id: 'agregado-adiantamento-70',
    titulo: 'Agregado também terá direito a adiantamento de 70% do frete',
    resumo: 'A mesma MP que cria o piso salarial CLT garante ao motorista agregado o adiantamento de pelo menos 70% do valor do frete antes da viagem, com o saldo pago em até 30 dias úteis — mesmo sem vínculo empregatício.',
    link: 'https://targetbank.com.br/blog-do-trecho/target-log/piso-salarial-mp1343/',
    imagemUrl: 'https://targetbank.com.br/wp-content/uploads/2026/07/Header-Blog-Piso-salarial.webp',
    data: '2026-07-17',
    categoria: 'agregado',
    ativo: true,
  },
  {
    id: 'agregado-fiscalizacao-ciot',
    titulo: 'Fiscalização do piso mínimo também vale para contrato de agregado',
    resumo: 'A nova sistemática da ANTT bloqueia automaticamente, via CIOT, qualquer frete contratado abaixo do piso mínimo — regra que vale tanto para autônomos independentes quanto para agregados vinculados a uma transportadora.',
    link: 'https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias/antt-atualiza-tabela-horas-apos-regulamentacao-historica-e-eleva-piso-com-base-no-diesel-a-r-7-35-reforcando-renda-e-travando-fretes-irregulares',
    imagemUrl: 'https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias/antt-atualiza-tabela-horas-apos-regulamentacao-historica-e-eleva-piso-com-base-no-diesel-a-r-7-35-reforcando-renda-e-travando-fretes-irregulares/df_tnrgo_abr2505182888.jpg/@@images/36e933b9-b9b2-4576-bd02-e2d25f49cb8b.jpeg',
    data: '2026-07-17',
    categoria: 'agregado',
    ativo: true,
  },
  {
    id: 'agregado-vinculo-empregaticio',
    titulo: 'Exclusividade e controle de horário podem gerar vínculo empregatício',
    resumo: 'A Justiça do Trabalho tem reconhecido vínculo empregatício de motoristas contratados como TAC-agregado quando ficam comprovados exclusividade, subordinação e controle de rotina pela transportadora — o que pode garantir direitos de CLT ao motorista.',
    link: 'https://www.jusbrasil.com.br/jurisprudencia/busca?q=tac+agregado',
    // Sem imagemUrl: é uma página de busca, não um artigo específico com imagem própria.
    // O card vai mostrar o ícone de fallback (📰) para esta notícia.
    data: '2026-07-17',
    categoria: 'agregado',
    ativo: true,
  },
];

async function main() {
  let enviadas = 0;
  for (const noticia of NOTICIAS) {
    const { id, ...dados } = noticia;
    await db.collection('noticias').doc(id).set(dados);
    enviadas++;
    console.log(`✅ (${enviadas}) [${dados.categoria}] ${dados.titulo}`);
  }
  console.log(`\n🎉 Concluído! ${enviadas} notícias cadastradas no Firestore.`);
}

main().catch((erro) => {
  console.error('❌ Erro ao importar:', erro);
  process.exit(1);
});
