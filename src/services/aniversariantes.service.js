/**
 * Aniversariantes da Loja do Alienígena.
 *
 * POR ENQUANTO: dados FICTÍCIOS gerados automaticamente para caírem
 * sempre dentro da semana atual — assim dá pra ver o card funcionando
 * na Home sem esperar a data certa. Quando você mandar o PDF real,
 * a gente troca a lista ANIVERSARIANTES por uma fixa (nome + dia + mês
 * de nascimento, sem o ano) extraída do PDF.
 */

function gerarFicticiosParaDemo() {
  const hoje = new Date();
  const nomes = ['Maria Alves', 'João Pedro Sousa', 'Francisco das Chagas', 'Ana Beatriz Lima'];
  return nomes.map((nome, i) => {
    const data = new Date(hoje);
    data.setDate(hoje.getDate() - 1 + i);
    return { nome, dia: data.getDate(), mes: data.getMonth() + 1 };
  });
}

const ANIVERSARIANTES = gerarFicticiosParaDemo();

function diasDaSemanaAtual() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0 = domingo
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - diaSemana);

  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(domingo);
    d.setDate(domingo.getDate() + i);
    dias.push({ dia: d.getDate(), mes: d.getMonth() + 1, ordem: i });
  }
  return dias;
}

export async function buscarAniversariantesDaSemana() {
  const semana = diasDaSemanaAtual();

  return ANIVERSARIANTES
    .filter((a) => semana.some((s) => s.dia === a.dia && s.mes === a.mes))
    .map((a) => ({ ...a, ordem: semana.find((s) => s.dia === a.dia && s.mes === a.mes).ordem }))
    .sort((a, b) => a.ordem - b.ordem);
}
