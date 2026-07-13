/**
 * Script de geocodificação: para cada empresa no Firestore que ainda não tem
 * latitude/longitude, busca o endereço num serviço gratuito (Nominatim/OpenStreetMap)
 * e salva "lat" e "lng" no documento.
 *
 * COMO USAR:
 * 1. Coloque este arquivo dentro da pasta "scripts/" do projeto (junto com
 *    o serviceAccountKey.json que você já tem lá).
 * 2. No terminal, dentro da pasta do projeto, rode:
 *      node scripts/geocodificar-empresas.cjs
 *
 * O script respeita o limite de 1 requisição por segundo do Nominatim
 * (é gratuito, mas pede uso responsável). Para ~70 empresas, demora uns 2 minutos.
 *
 * IMPORTANTE: geocodificação por texto pode errar endereços rurais/informais
 * (tipo "BR-304, km 142, Zona Rural"). Revise os resultados com "lat/lng aproximado"
 * marcados no log, e corrija manualmente no Firestore se precisar.
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

const CAMINHO_CHAVE = path.join(__dirname, 'serviceAccountKey.json');

initializeApp({
  credential: cert(require(CAMINHO_CHAVE)),
});
const db = getFirestore();

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocodificarEndereco(endereco) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(endereco)}`;

  const resposta = await fetch(url, {
    headers: {
      // Nominatim exige um User-Agent identificável para uso gratuito.
      'User-Agent': 'TraV5-App/1.0 (contato: jfilhoempresarial-ops)',
    },
  });

  if (!resposta.ok) {
    throw new Error(`Falha na requisição: ${resposta.status}`);
  }

  const dados = await resposta.json();
  if (dados.length === 0) {
    return null;
  }

  return {
    lat: parseFloat(dados[0].lat),
    lng: parseFloat(dados[0].lon),
  };
}

async function main() {
  const snapshot = await db.collection('empresas').get();
  console.log(`Total de empresas encontradas: ${snapshot.size}\n`);

  let atualizadas = 0;
  let semResultado = 0;
  let jaTinhamCoordenadas = 0;

  for (const doc of snapshot.docs) {
    const dados = doc.data();

    if (dados.lat && dados.lng) {
      jaTinhamCoordenadas++;
      continue;
    }

    if (!dados.endereco) {
      console.warn(`⚠️  "${dados.nome}" não tem endereço cadastrado — pulando.`);
      continue;
    }

    try {
      const coordenadas = await geocodificarEndereco(dados.endereco);

      if (!coordenadas) {
        console.warn(`❌ Não achou coordenadas para "${dados.nome}" (${dados.endereco})`);
        semResultado++;
      } else {
        await doc.ref.update({
          lat: coordenadas.lat,
          lng: coordenadas.lng,
        });
        console.log(`✅ ${dados.nome} — lat: ${coordenadas.lat}, lng: ${coordenadas.lng}`);
        atualizadas++;
      }
    } catch (erro) {
      console.error(`❌ Erro ao geocodificar "${dados.nome}":`, erro.message);
    }

    // Respeita o limite de 1 requisição/segundo do Nominatim.
    await esperar(1100);
  }

  console.log(`\n🎉 Concluído!`);
  console.log(`   ${atualizadas} empresas atualizadas com coordenadas.`);
  console.log(`   ${jaTinhamCoordenadas} já tinham coordenadas (puladas).`);
  console.log(`   ${semResultado} não foram encontradas (revise o endereço manualmente).`);
}

main().catch((erro) => {
  console.error('Erro geral:', erro);
  process.exit(1);
});
