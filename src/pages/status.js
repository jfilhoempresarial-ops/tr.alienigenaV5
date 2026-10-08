/**
 * Página /status — painel dos robôs e do site, tudo numa tela só.
 *
 * Lê direto da API pública do GitHub (o repositório é público, não precisa de senha):
 *  - a última execução de cada robô (GitHub Actions)
 *  - o último deploy do site na Vercel (a Vercel registra cada deploy no GitHub)
 *
 * Limite do GitHub sem login: 60 consultas por hora por internet. Cada abertura
 * da página gasta de 4 a 8, então dá para atualizar várias vezes por hora.
 */

const DONO = 'jfilhoempresarial-ops';
const REPO = 'tr.alienigenaV5';
const API = `https://api.github.com/repos/${DONO}/${REPO}`;
const LINK_ACTIONS = `https://github.com/${DONO}/${REPO}/actions`;
const LINK_VERCEL = 'https://vercel.com/dashboard';
const ATUALIZAR_A_CADA_MS = 5 * 60 * 1000;

let timerAuto = null;

const ESTILO = `
<style id="status-estilo">
  .status-pagina { max-width: 760px; margin: 0 auto; padding-block: 16px 32px; }
  .status-topo { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .status-topo h1 { font-size: 22px; margin: 0; }
  .status-atualizar { border: 1px solid var(--cor-primaria); color: var(--cor-primaria); background: transparent; border-radius: 999px; padding: 6px 14px; font-weight: 600; cursor: pointer; }
  .status-atualizar:disabled { opacity: .5; cursor: default; }
  .status-resumo { border-radius: var(--radius); padding: 14px 16px; margin-bottom: 16px; font-weight: 600; display: flex; gap: 10px; align-items: center; }
  .status-resumo--ok { background: #e6f4ea; color: #1b5e20; }
  .status-resumo--erro { background: #fdecea; color: #8a1c13; }
  .status-resumo--rodando { background: #fff6d6; color: #6b4e00; }
  .status-resumo small { display: block; font-weight: 400; opacity: .8; margin-top: 2px; }
  .status-secao { margin: 20px 0 8px; font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: #667; }
  .status-lista { list-style: none; padding: 0; margin: 0; background: var(--cor-branco); border-radius: var(--radius); box-shadow: 0 1px 3px rgba(0,0,0,.06); overflow: hidden; }
  .status-item { display: grid; grid-template-columns: 28px 1fr auto; gap: 10px; align-items: center; padding: 12px 14px; border-top: 1px solid #eef0ee; }
  .status-item:first-child { border-top: 0; }
  .status-item--erro { background: #fff7f6; }
  .status-icone { font-size: 18px; text-align: center; }
  .status-nome { min-width: 0; }
  .status-nome strong { display: block; font-size: 15px; line-height: 1.3; overflow-wrap: anywhere; }
  .status-nome span { font-size: 12px; color: #667; }
  .status-quando { font-size: 12px; color: #667; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .status-quando a { display: inline-block; margin-top: 4px; color: var(--cor-primaria); font-weight: 600; text-decoration: none; }
  .status-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 20px; }
  .status-links a { flex: 1 1 200px; text-align: center; padding: 10px; border-radius: var(--radius); background: var(--cor-primaria); color: #fff; text-decoration: none; font-weight: 600; }
  .status-nota { font-size: 12px; color: #889; margin-top: 12px; }
</style>`;

function tempoAtras(iso) {
  if (!iso) return '';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}

function dataHora(iso) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Traduz o resultado do GitHub em: ok, erro, rodando, cancelado, desligado, nunca */
function situacaoDaExecucao(run) {
  if (!run) return 'nunca';
  if (run.status !== 'completed') return 'rodando';
  if (run.conclusion === 'success') return 'ok';
  if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') return 'cancelado';
  return 'erro';
}

const VISUAL = {
  erro: { icone: '❌', texto: 'Deu erro', ordem: 0 },
  desligado: { icone: '⛔', texto: 'Desligado pelo GitHub', ordem: 1 },
  rodando: { icone: '🟡', texto: 'Rodando agora', ordem: 2 },
  cancelado: { icone: '⚪', texto: 'Cancelado', ordem: 3 },
  nunca: { icone: '⚪', texto: 'Ainda não rodou', ordem: 4 },
  ok: { icone: '✅', texto: 'Tudo certo', ordem: 5 },
};

async function buscarJson(caminho) {
  const resp = await fetch(`${API}${caminho}`, { headers: { Accept: 'application/vnd.github+json' } });
  if (resp.status === 403 || resp.status === 429) {
    throw new Error('O GitHub limitou as consultas desta internet por alguns minutos. Espere um pouco e toque em Atualizar.');
  }
  if (!resp.ok) throw new Error(`O GitHub respondeu com erro ${resp.status}.`);
  return resp.json();
}

async function carregarRobos() {
  const [{ workflows = [] }, { workflow_runs: runs = [] }] = await Promise.all([
    buscarJson('/actions/workflows?per_page=100'),
    buscarJson('/actions/runs?per_page=100'),
  ]);

  // Última execução de cada robô (a lista já vem da mais nova para a mais velha)
  const ultima = {};
  runs.forEach((r) => {
    if (!ultima[r.workflow_id]) ultima[r.workflow_id] = r;
  });

  // Robôs semanais podem não aparecer nas 100 últimas execuções: busca só esses
  const faltando = workflows.filter((w) => !ultima[w.id] && w.state === 'active');
  await Promise.all(
    faltando.map(async (w) => {
      try {
        const { workflow_runs: lista = [] } = await buscarJson(`/actions/workflows/${w.id}/runs?per_page=1`);
        if (lista[0]) ultima[w.id] = lista[0];
      } catch {
        // sem problema: aparece como "ainda não rodou"
      }
    })
  );

  return workflows.map((w) => {
    const run = ultima[w.id];
    const desligado = w.state !== 'active';
    return {
      nome: w.name,
      situacao: desligado ? 'desligado' : situacaoDaExecucao(run),
      quando: run && (run.updated_at || run.created_at),
      link: run ? run.html_url : `https://github.com/${DONO}/${REPO}/actions/workflows/${w.path.split('/').pop()}`,
      gatilho: run && run.event === 'schedule' ? 'automático' : run && run.event === 'push' ? 'após commit' : run ? 'manual' : '',
    };
  });
}

async function carregarSite() {
  const deploys = await buscarJson('/deployments?per_page=5');
  const producao = deploys.find((d) => /production/i.test(d.environment)) || deploys[0];
  if (!producao) return null;
  const statuses = await buscarJson(`/deployments/${producao.id}/statuses?per_page=1`);
  const s = statuses[0];
  const mapa = { success: 'ok', failure: 'erro', error: 'erro', pending: 'rodando', in_progress: 'rodando', queued: 'rodando', inactive: 'ok' };
  return {
    nome: 'Site no ar (Vercel)',
    situacao: s ? mapa[s.state] || 'cancelado' : 'rodando',
    quando: (s && s.created_at) || producao.created_at,
    link: (s && (s.log_url || s.target_url)) || LINK_VERCEL,
    gatilho: 'deploy de produção',
  };
}

function renderItem(item) {
  const v = VISUAL[item.situacao];
  return `
    <li class="status-item ${item.situacao === 'erro' || item.situacao === 'desligado' ? 'status-item--erro' : ''}">
      <span class="status-icone" aria-hidden="true">${v.icone}</span>
      <span class="status-nome">
        <strong>${item.nome}</strong>
        <span>${v.texto}${item.gatilho ? ` · ${item.gatilho}` : ''}</span>
      </span>
      <span class="status-quando">
        ${item.quando ? `<span title="${dataHora(item.quando)}">${tempoAtras(item.quando)}</span><br>` : ''}
        <a href="${item.link}" target="_blank" rel="noopener">${item.situacao === 'erro' ? 'Ver erro' : 'Abrir'}</a>
      </span>
    </li>`;
}

function renderResumo(robos, site) {
  const todos = site ? [site, ...robos] : robos;
  const erros = todos.filter((i) => i.situacao === 'erro' || i.situacao === 'desligado');
  const rodando = todos.filter((i) => i.situacao === 'rodando');
  if (erros.length) {
    return `<div class="status-resumo status-resumo--erro">❌<div>${erros.length === 1 ? '1 item precisa de atenção' : `${erros.length} itens precisam de atenção`}<small>${erros.map((e) => e.nome).join(' · ')}</small></div></div>`;
  }
  if (rodando.length) {
    return `<div class="status-resumo status-resumo--rodando">🟡<div>Nenhum erro. ${rodando.length === 1 ? '1 robô está rodando agora.' : `${rodando.length} robôs estão rodando agora.`}</div></div>`;
  }
  return `<div class="status-resumo status-resumo--ok">✅<div>Tudo certo<small>O site e os ${robos.length} robôs rodaram sem erro da última vez.</small></div></div>`;
}

export async function renderStatus(container) {
  clearInterval(timerAuto);
  if (!document.getElementById('status-estilo')) document.head.insertAdjacentHTML('beforeend', ESTILO);

  container.innerHTML = `
    <section class="status-pagina">
      <div class="status-topo">
        <h1>Painel dos robôs</h1>
        <button id="status-atualizar" class="status-atualizar">🔄 Atualizar</button>
      </div>
      <div id="status-conteudo"><p class="loading">Consultando o GitHub...</p></div>
      <div class="status-links">
        <a href="${LINK_ACTIONS}" target="_blank" rel="noopener">GitHub Actions</a>
        <a href="${LINK_VERCEL}" target="_blank" rel="noopener">Vercel</a>
      </div>
      <p class="status-nota" id="status-nota"></p>
    </section>`;

  const alvo = container.querySelector('#status-conteudo');
  const botao = container.querySelector('#status-atualizar');
  const nota = container.querySelector('#status-nota');

  async function carregar() {
    if (!document.body.contains(alvo)) {
      clearInterval(timerAuto); // saiu da página
      return;
    }
    botao.disabled = true;
    try {
      const [robos, site] = await Promise.all([carregarRobos(), carregarSite().catch(() => null)]);
      robos.sort((a, b) => VISUAL[a.situacao].ordem - VISUAL[b.situacao].ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
      alvo.innerHTML = `
        ${renderResumo(robos, site)}
        ${site ? `<h2 class="status-secao">Site</h2><ul class="status-lista">${renderItem(site)}</ul>` : ''}
        <h2 class="status-secao">Robôs (${robos.length})</h2>
        <ul class="status-lista">${robos.map(renderItem).join('')}</ul>`;
      nota.textContent = `Consultado às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}. Atualiza sozinho a cada 5 minutos enquanto a página estiver aberta.`;
    } catch (erro) {
      alvo.innerHTML = `<p class="erro">${erro.message || 'Não foi possível consultar o GitHub agora.'}</p>`;
    } finally {
      botao.disabled = false;
    }
  }

  botao.addEventListener('click', carregar);
  timerAuto = setInterval(carregar, ATUALIZAR_A_CADA_MS);
  await carregar();
}
