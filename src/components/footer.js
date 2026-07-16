const NUMERO_WHATSAPP = '5588988621481';

export function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;

  el.innerHTML = `
    <footer class="footer">
      <div class="footer__coluna">
        <img src="/images/logo/Logo-tra.png" alt="TRA da Estrada" class="footer__logo" />
        <p class="footer__texto">
          Uma plataforma feita por caminhoneiro pra caminhoneiro, conectando motoristas
          a serviços, vagas, fretes e informação em toda a estrada.
        </p>
      </div>

      <div class="footer__coluna">
        <h3 class="footer__titulo">O que fazemos</h3>
        <p class="footer__texto">
          Reunimos mecânicos, postos, borracharias, pontos de apoio, vagas de emprego
          e notícias do setor, tudo num só lugar, pensado pra rotina de quem vive na estrada.
        </p>
      </div>

      <div class="footer__coluna">
        <h3 class="footer__titulo">Onde estamos</h3>
        <p class="footer__texto">
          📍 Sobral, CE — atendendo motoristas em todo o Ceará.
        </p>
        <a
          href="https://wa.me/${NUMERO_WHATSAPP}"
          target="_blank"
          rel="noopener"
          class="footer__whatsapp"
        >
          💬 (88) 98862-1481
        </a>
      </div>

      <div class="footer__base">
        <p>© ${new Date().getFullYear()} TRA da Estrada. Todos os direitos reservados.</p>
      </div>
    </footer>
  `;
}

export function renderWhatsappFloat() {
  const el = document.getElementById('whatsapp-float');
  if (!el) return;

  el.innerHTML = `
    <a
      href="https://wa.me/${NUMERO_WHATSAPP}"
      target="_blank"
      rel="noopener"
      class="whatsapp-float"
      aria-label="Falar no WhatsApp"
    >
      💬
    </a>
  `;
}

