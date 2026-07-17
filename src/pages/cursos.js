const CURSOS_EAD = [
  {
    titulo: 'Cálculo do Frete',
    descricao: 'Aprenda a administrar os gastos do caminhão e calcular os custos de uma viagem, garantindo um bom preço e uma boa gestão do negócio.',
  },
  {
    titulo: 'Manutenção Preventiva de Veículos',
    descricao: 'Ensina a manutenção correta do veículo, aumentando durabilidade do motor, segurança na viagem e economia no fim do mês.',
  },
  {
    titulo: 'Gestão de Combustível',
    descricao: 'Melhores práticas de direção para mais eficiência, reduzindo consumo de combustível e emissões.',
  },
  {
    titulo: 'Gestão de Pneus',
    descricao: 'Conceitos de gestão de pneus, desde a escolha até o destino final dos pneus usados.',
  },
  {
    titulo: 'Tecnologias para o Transporte',
    descricao: 'Como as tecnologias embarcadas contribuem para economia, redução de poluentes e mais segurança e conforto na direção.',
  },
  {
    titulo: 'Excelência Profissional para Motoristas',
    descricao: 'Cuidados com o veículo, economia, segurança na operação e relacionamento com o cliente e o meio ambiente.',
  },
];

export function renderCursos(container) {
  container.innerHTML = `
    <section class="cursos-pagina">
      <div class="cursos-pagina__header">
        <h1>🎓 Cursos para o Motorista</h1>
        <p>Capacitação gratuita do SEST SENAT, direto do celular, no seu tempo.</p>
      </div>

      <div class="cursos-pagina__destaque">
        <h2 class="cursos-pagina__destaque-titulo">🪪 Programa Mais Motoristas 2026</h2>
        <p class="cursos-pagina__destaque-texto">
          O SEST SENAT está custeando exames, curso prático e mudança de categoria da CNH
          (para C, D ou E) gratuitamente para quem quer se qualificar como motorista profissional.
        </p>
        <a href="https://www.sestsenat.org.br/cursos/mais-motoristas" target="_blank" rel="noopener" class="cursos-pagina__destaque-link">
          Ver como se inscrever →
        </a>
      </div>

      <h2 class="cursos-pagina__secao-titulo">📚 Cursos EAD gratuitos</h2>
      <p class="cursos-pagina__secao-sub">
        Feitos pela internet, no celular, computador ou tablet — sem precisar frequentar aula, no
        seu próprio ritmo. Todos com certificado.
      </p>

      <div class="cursos-lista">
        ${CURSOS_EAD.map(
          (curso) => `
          <div class="curso-card">
            <p class="curso-card__titulo">${curso.titulo}</p>
            <p class="curso-card__descricao">${curso.descricao}</p>
          </div>
        `
        ).join('')}
      </div>

      <a href="https://ead.sestsenat.org.br" target="_blank" rel="noopener" class="cursos-pagina__botao-todos">
        Ver todos os cursos na plataforma EaD SEST SENAT
      </a>
    </section>
  `;
}
