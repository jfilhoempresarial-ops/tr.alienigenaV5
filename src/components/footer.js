export function renderFooter() {
  const el = document.getElementById('footer');
  if (!el) return;

  el.innerHTML = `
    <div style="background: red; color: white; text-align: center; padding: 40px; font-size: 20px; font-weight: bold;">
      TESTE — RODAPÉ REMOVIDO
    </div>
  `;
}

export function renderWhatsappFloat() {
  const el = document.getElementById('whatsapp-float');
  if (!el) return;
  el.innerHTML = '';
}