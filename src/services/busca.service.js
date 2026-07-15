import { buscarTodasEmpresas } from './empresas.service.js';
import { buscarVagas } from './vagas.service.js';
import { buscarFretesDestaque } from './fretes.service.js';
import { buscarGruposWhatsappAtivos } from './grupos-whatsapp.service.js';
import { buscarAniversariantesDaSemana } from './aniversariantes.service.js';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const LABEL_CATEGORIA = {
  mecanico: 'Mecânico',
  posto: 'Posto',
  borracharia: 'Borracharia',
  eletrica: 'Elétrica',
  guincho: 'Guincho Socorro',
  pontoapoio: 'Ponto de Apoio',
  autopecas: 'Auto Peças',
  lavajato: 'Lava-Jato',
};

/**
 * Busca global: procura o termo digitado em empresas, vagas, fretes,
 * grupos de WhatsApp e aniversariantes da semana, tudo de uma vez.
 */
export async function buscarNoSite(termo) {
  const qn = normalizar(termo);
  if (!qn) {
    return { empresas: [], vagas: [], fretes: [], grupos: [], aniversariantes: [] };
  }

  const [empresasR, vagasR, fretesR, gruposR, aniversariantesR] = await Promise.allSettled([
    buscarTodasEmpresas(),
    buscarVagas(),
    buscarFretesDestaque(50),
    buscarGruposWhatsappAtivos(),
    buscarAniversariantesDaSemana(),
  ]);

  const todasEmpresas = empresasR.status === 'fulfilled' ? empresasR.value : [];
  const empresas = todasEmpresas.filter((e) => {
    const nome = normalizar(e.nome);
    const endereco = normalizar(e.endereco);
    const categorias = (e.categorias || []).map((c) => normalizar(LABEL_CATEGORIA[c] || c));
    return nome.includes(qn) || endereco.includes(qn) || categorias.some((c) => c.includes(qn));
  });

  const todasVagas = vagasR.status === 'fulfilled' ? vagasR.value.itens || [] : [];
  const vagas = todasVagas.filter(
    (v) => normalizar(v.cargo).includes(qn) || normalizar(v.cidade).includes(qn)
  );

  const todosFretes = fretesR.status === 'fulfilled' ? fretesR.value : [];
  const fretes = todosFretes.filter(
    (f) =>
      normalizar(f.veiculo).includes(qn) ||
      normalizar(f.carroceria).includes(qn) ||
      normalizar(f.carga).includes(qn) ||
      normalizar(f.cidadeOrigem).includes(qn) ||
      normalizar(f.cidadeDestino).includes(qn)
  );

  const todosGrupos = gruposR.status === 'fulfilled' ? gruposR.value : [];
  const grupos = todosGrupos.filter(
    (g) => normalizar(g.nomeGrupo).includes(qn) || normalizar(g.cidade).includes(qn)
  );

  const todosAniversariantes = aniversariantesR.status === 'fulfilled' ? aniversariantesR.value : [];
  const aniversariantes = todosAniversariantes.filter((a) => normalizar(a.nome).includes(qn));

  return { empresas, vagas, fretes, grupos, aniversariantes };
}