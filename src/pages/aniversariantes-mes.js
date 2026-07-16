import { buscarAniversariantesDoMes } from '../services/aniversariantes.service.js';

function capitalizarNome(txt) {
  return (txt || '')
    .toLowerCase()
    .replace(/(^|\s|\()\S/g, (letra) => letra.toUpperCase());
}

export async function renderAniversariantesMes(container) {
  container.innerHTML = `<p class="loading">Carregando aniversariantes...</p>`;

  let aniversariantes;
  try {
    aniversariantes = await buscarAniversariantesDoMes();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar agora. Tente novamente.</p>`;
    console.error(erro);
    return;
  }

  if (aniversariantes.length === 0) {
    container.innerHTML = `<p class="vazio">Nenhum aniversariante cadastrado este mês.</p>`;
    return;
  }

  const nomeMes = new Date().toLocaleDateString('pt-BR', { month: 'long' });

  container.innerHTML = `
    <section class="aniversariantes-mes">
      <div class="aniversariantes-mes__header">
        <h1>🎂 ${aniversariantes.length} aniversariante${aniversariantes.length !== 1 ? 's' : ''} em ${nomeMes}</h1>
        <p>Motoristas clientes da Loja do Alienígena que fazem aniversário este mês</p>
      </div>
      <ul class="aniversariantes-mes__lista">
        ${aniversariantes
          .map(
            (p) =>
              `<li><span>${capitalizarNome(p.nome)}</span><span class="aniversariantes-mes__data">${String(p.dia).padStart(2, '0')}/${String(p.mes).padStart(2, '0')}</span></li>`
          )
          .join('')}
      </ul>
    </section>
  `;
}
