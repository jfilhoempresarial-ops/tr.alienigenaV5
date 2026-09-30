/**
 * "Toque e segure para copiar" — serve para qualquer botão ou link.
 *
 *  - toque rápido          → faz o que o botão já fazia (ex.: abrir o WhatsApp)
 *  - toque e segure (0,6s) → o botão avisa "Solte para copiar" e, ao soltar,
 *                            copia o texto para a área de transferência.
 *
 * A cópia acontece ao SOLTAR o dedo porque o celular só libera a área de
 * transferência logo depois de um gesto do usuário (um timer rodando com o
 * dedo parado não conta). Se não der para copiar, abre o "Compartilhar".
 */

export async function copiarTexto(texto) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
  } catch {
    // cai no plano B
  }

  // Plano B para navegadores antigos / app Android (TWA)
  const campo = document.createElement('textarea');
  campo.value = texto;
  campo.setAttribute('readonly', '');
  campo.style.position = 'fixed';
  campo.style.top = '0';
  campo.style.opacity = '0';
  document.body.appendChild(campo);
  campo.select();
  campo.setSelectionRange(0, texto.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  campo.remove();
  return ok;
}

/**
 * @param {HTMLElement} elemento   botão ou link
 * @param {object} opcoes
 * @param {() => string} opcoes.obterTexto      o que vai ser copiado
 * @param {(msg: string) => void} opcoes.avisar mostra o aviso na tela
 * @param {string} [opcoes.mensagemCopiado]
 * @param {string} [opcoes.tituloCompartilhar]
 */
export function ativarSegurarParaCopiar(elemento, opcoes) {
  const {
    obterTexto,
    avisar,
    mensagemCopiado = '🔗 Link copiado!',
    tituloCompartilhar = 'TR Alienígena',
  } = opcoes;
  const TEMPO_SEGURAR = 600; // ms
  const HTML_ORIGINAL = elemento.innerHTML;
  let timer = null;
  let prontoParaCopiar = false;
  let bloquearClique = false;

  function voltarAoNormal() {
    clearTimeout(timer);
    timer = null;
    prontoParaCopiar = false;
    elemento.classList.remove('segurar-copiar--segurando', 'segurar-copiar--pronto');
    elemento.innerHTML = HTML_ORIGINAL;
  }

  async function copiar() {
    voltarAoNormal();
    const texto = obterTexto();
    if (await copiarTexto(texto)) {
      avisar(mensagemCopiado);
      return;
    }
    if (navigator.share) {
      try {
        await navigator.share({ title: tituloCompartilhar, url: texto });
        return;
      } catch {
        // pessoa fechou o compartilhar — mostra o link
      }
    }
    avisar(`Copie o link: ${texto}`);
  }

  elemento.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    voltarAoNormal();
    bloquearClique = false;
    elemento.classList.add('segurar-copiar--segurando');
    timer = setTimeout(() => {
      timer = null;
      prontoParaCopiar = true;
      bloquearClique = true;
      elemento.classList.add('segurar-copiar--pronto');
      elemento.textContent = '🔗 Solte para copiar';
      if (navigator.vibrate) navigator.vibrate(40);
    }, TEMPO_SEGURAR);
  });

  elemento.addEventListener('pointerup', () => {
    if (prontoParaCopiar) copiar();
    else voltarAoNormal();
  });

  // Alguns Android cancelam o toque quando o dedo fica parado muito tempo.
  elemento.addEventListener('pointercancel', () => {
    if (prontoParaCopiar) copiar();
    else voltarAoNormal();
  });

  elemento.addEventListener('pointerleave', () => {
    if (!prontoParaCopiar) voltarAoNormal();
  });

  // Se foi um "segurar", não abre o link
  elemento.addEventListener('click', (e) => {
    if (bloquearClique) {
      e.preventDefault();
      bloquearClique = false;
    }
  });

  // Sem o menu padrão do celular ("abrir em nova aba"...) e sem arrastar o link
  elemento.addEventListener('contextmenu', (e) => e.preventDefault());
  elemento.addEventListener('dragstart', (e) => e.preventDefault());
}
