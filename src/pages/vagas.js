import { buscarVagas } from '../services/vagas.service.js';
import { renderCarrosselBanners } from '../components/carrossel-banners.js';

function normalizar(txt) {
  return (txt || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function formatarData(iso) {
  if (!iso) return 'ainda não atualizado';
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function renderCardUnidadeSine(vaga) {
  const tel = (vaga.fone || '').replace(/\D/g, '');
  if (!vaga.endereco && !tel && !vaga.email) return '';
  return `
    <div class="sine-unidade">
      <div class="sine-unidade__titulo">🏛️ SINE — ${vaga.cidade}</div>
      ${vaga.endereco ? `<div class="sine-unidade__linha">📍 ${vaga.endereco}</div>` : ''}
      ${tel ? `<div class="sine-unidade__linha">📞 ${vaga.fone}</div>` : ''}
      ${vaga.email ? `<div class="sine-unidade__linha">✉️ ${vaga.email}</div>` : ''}
      <div class="sine-unidade__acoes">
        ${tel ? `<a href="tel:+55${tel}" class="btn-ligar">📞 Ligar</a>` : ''}
        ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" class="btn-whatsapp">💬 WhatsApp</a>` : ''}
        ${vaga.email ? `<a href="mailto:${vaga.email}" class="btn-email">✉️ E-mail</a>` : ''}
      </div>
    </div>
  `;
}

function renderCardVaga(vaga) {
  const tel = (vaga.fone || '').replace(/\D/g, '');
  return `
    <div class="vaga-card">
      <div class="vaga-card__cargo">${vaga.cargo}</div>
      <div class="vaga-card__local">📍 ${vaga.cidade} • ${vaga.quantidade} vaga${vaga.quantidade !== 1 ? 's' : ''}</div>
      <div class="vaga-card__acoes">
        ${tel ? `<a href="tel:+55${tel}" class="btn-ligar">📞 Ligar</a>` : ''}
        ${tel ? `<a href="https://wa.me/55${tel}" target="_blank" rel="noopener" class="btn-whatsapp">💬 WhatsApp</a>` : ''}
      </div>
    </div>
  `;
}

export async function renderVagas(container) {
  container.innerHTML = `<p class="loading">Carregando vagas...</p>`;

  let dados;
  try {
    dados = await buscarVagas();
  } catch (erro) {
    container.innerHTML = `<p class="erro">Não foi possível carregar as vagas agora. Tente novamente em instantes.</p>`;
    console.error(erro);
    return;
  }

  const itens = dados.itens || [];
  const cidades = [...new Set(itens.map((v) => v.cidadeBase).filter(Boolean))].sort();

  let filtroCidade = '';
  let filtroTexto = '';

  function aplicarFiltros() {
    const qn = normalizar(filtroTexto);
    return itens
      .filter((v) => {
        const bateCidade = !filtroCidade || v.cidadeBase === filtroCidade;
        const bateTexto = !qn || normalizar(v.cidade).includes(qn) || normalizar(v.cargo).includes(qn);
        return bateCidade && bateTexto;
      })
      .sort((a, b) => (b.quantidade || 1) - (a.quantidade || 1));
  }

  function render() {
    const filtradas = aplicarFiltros();
    const total = itens.reduce((s, v) => s +