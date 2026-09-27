/**
 * Calendário do Transporte: datas comemorativas que se repetem todo ano.
 * Aparecem na página "Eventos / Calendário", sempre na ordem da mais próxima.
 *
 * COMO ADICIONAR UMA DATA NOVA:
 * Copie uma linha e troque dia, mês, título e descrição.
 * Para um período (várias datas seguidas), preencha também "ateDia" e "ateMes".
 */
export const DATAS_COMEMORATIVAS = [
  { dia: 13, mes: 2, titulo: 'Dia Mundial do Rádio', descricao: 'Data da UNESCO em homenagem ao rádio no mundo todo.' },
  { dia: 30, mes: 4, titulo: 'Dia do Ferroviário', descricao: 'Homenagem aos trabalhadores do transporte sobre trilhos.' },
  { dia: 1, mes: 5, ateDia: 31, ateMes: 5, titulo: 'Maio Amarelo', descricao: 'Mês de campanhas pela segurança no trânsito.' },
  { dia: 6, mes: 6, titulo: 'Dia da Logística', descricao: 'Homenagem a quem planeja e movimenta as cargas do país.' },
  { dia: 25, mes: 7, titulo: 'Dia de São Cristóvão e Dia do Motorista', descricao: 'Padroeiro dos motoristas. A data mais festejada pelos caminhoneiros, com missas, carreatas e bênção dos veículos.' },
  { dia: 27, mes: 7, titulo: 'Dia Nacional do Motociclista', descricao: 'Data oficial pela Lei 15.006/2024.' },
  { dia: 16, mes: 9, titulo: 'Dia Nacional do Caminhoneiro e da Caminhoneira', descricao: 'Data oficial em todo o Brasil pela Lei 11.927/2009.' },
  { dia: 17, mes: 9, titulo: 'Dia do Transportador Rodoviário de Cargas', descricao: 'Homenagem às empresas e aos autônomos do transporte de cargas.' },
  { dia: 18, mes: 9, ateDia: 25, ateMes: 9, titulo: 'Semana Nacional de Trânsito', descricao: 'Semana de ações de educação e segurança no trânsito.' },
  { dia: 25, mes: 9, titulo: 'Dia Nacional do Rádio e Dia Nacional do Trânsito', descricao: 'Rádio: data oficial pela Lei 15.101/2025, dia de A Voz do Motorista. Trânsito: encerra a Semana Nacional de Trânsito.' },
  { dia: 12, mes: 10, titulo: 'Nossa Senhora Aparecida', descricao: 'Padroeira do Brasil, também invocada como protetora dos caminhoneiros. Feriado nacional.' },
  { dia: 20, mes: 12, titulo: 'Dia do Mecânico', descricao: 'Homenagem a quem mantém os caminhões rodando.' },
];
