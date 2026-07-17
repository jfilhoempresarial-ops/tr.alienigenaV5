import { cadastrarNewsletter } from '../services/newsletter.service.js';

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

      <div class="footer__coluna footer__coluna--newsletter">
        <h3 class="footer__titulo">Newsletter</h3>
        <p class="footer__texto">
          Cadastre seu e-mail e fique por dentro das novidades da estrada!
        </p>
        <form id="newsletter-form" class="footer__newsletter-form">
          <input
            type="text"
            id="newsletter-nome"
            class="footer__newsletter-input"
            placeholder="Digite seu nome"
            required
          />
          <input
            type="email"
            id="newsletter-email"
            class="footer__newsletter-input"
            placeholder="Digite seu e-mail"
            required
          />
          <button type="submit" class="footer__newsletter-botao">Inscrever-se</button>
        </form>
        <p id="newsletter-mensagem" class="footer__newsletter-mensagem"></p>
      </div>

      <div class="footer__base">
        <p>© ${new Date().getFullYear()} TRA da Estrada. Todos os direitos reservados.</p>
      </div>
    </footer>
  `;

  configurarNewsletter(el);
}

function configurarNewsletter(el) {
  const form = el.querySelector('#newsletter-form');
  const mensagem = el.querySelector('#newsletter-mensagem');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = el.querySelector('#newsletter-nome').value;
    const email = el.querySelector('#newsletter-email').value;

    const botao = form.querySelector('.footer__newsletter-botao');
    botao.disabled = true;
    botao.textContent = 'Enviando...';

    try {
      await cadastrarNewsletter(nome, email);
      form.reset();
      mensagem.textContent = '✅ Inscrição feita com sucesso!';
      mensagem.className = 'footer__newsletter-mensagem footer__newsletter-mensagem--sucesso';
    } catch (erro) {
      mensagem.textContent = 'Não foi possível cadastrar agora. Tente novamente.';
      mensagem.className = 'footer__newsletter-mensagem footer__newsletter-mensagem--erro';
      console.error(erro);
    } finally {
      botao.disabled = false;
      botao.textContent = 'Inscrever-se';
    }
  });
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
