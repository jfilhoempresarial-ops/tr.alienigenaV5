import { cadastrarNewsletter } from '../services/newsletter.service.js';

const NUMERO_WHATSAPP = '5588988621481';

const LINKS_NAVEGACAO = [
  { href: '/', label: 'Home' },
  { href: '/noticias', label: 'Notícias' },
  { href: '/vagas', label: 'Vagas' },
  { href: '/fretes', label: 'Fretes' },
  { href: '/eventos', label: 'Eventos' },
  { href: '/caminhoes', label: 'Caminhões' },
];

const LINKS_INSTITUCIONAL = [
  { href: '/quem-somos', label: 'Quem Somos' },
  { href: '/o-que-fazemos', label: 'O que Fazemos' },
  { href: '/onde-estamos', label: 'Onde Estamos' },
  { href: '/cursos', label: 'Cursos' },
  { href: '/empresas-parceiras', label: 'Empresas Parceiras' },
  { href: '/contato', label: 'Contato' },
];

export function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;

  el.innerHTML = `
    <footer class="footer">
      <div class="footer__grid">
        <div class="footer__coluna footer__coluna--logo">
          <img src="/images/logo-tra.png" alt="TRA da Estrada" class="footer__logo" />
          <p class="footer__texto">
            Feito por caminhoneiro pra caminhoneiro.
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

        <div class="footer__colunas-duplas">
          <div class="footer__coluna">
            <h3 class="footer__titulo">Navegação</h3>
            ${LINKS_NAVEGACAO.map((link) => `<a href="${link.href}" class="footer__link">${link.label}</a>`).join('')}
          </div>

          <div class="footer__coluna">
            <h3 class="footer__titulo">Institucional</h3>
            ${LINKS_INSTITUCIONAL.map((link) => `<a href="${link.href}" class="footer__link">${link.label}</a>`).join('')}
          </div>
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