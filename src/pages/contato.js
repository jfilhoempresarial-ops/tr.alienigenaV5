const NUMERO_WHATSAPP = '5588988621481';

export function renderContato(container) {
  container.innerHTML = `
    <section class="institucional-pagina">
      <h1>Contato</h1>
      <p>Fale com a gente pelos canais abaixo:</p>

      <a
        href="https://wa.me/${NUMERO_WHATSAPP}"
        target="_blank"
        rel="noopener"
        class="institucional-pagina__whatsapp"
      >
        💬 WhatsApp: (88) 98862-1481
      </a>

      <p class="institucional-pagina__endereco">
        📍 BR-222, KM 222 — Sobral, CE
      </p>
    </section>
  `;
}