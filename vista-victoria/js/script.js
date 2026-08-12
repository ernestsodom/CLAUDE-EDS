/**
 * Condominio Vista Victoria — réplica funcional
 * - Controla los carruseles de imágenes (El Conjunto / La Casa)
 * - Maneja el envío del formulario de contacto (demo, sin backend real)
 */

document.addEventListener('DOMContentLoaded', () => {
  initCarousels();
  initLeadForm();
});

/* ---------------- Carousels ---------------- */
function initCarousels() {
  const carousels = document.querySelectorAll('[data-carousel]');

  carousels.forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll('.carousel__slide'));
    const prevBtn = carousel.querySelector('[data-carousel-prev]');
    const nextBtn = carousel.querySelector('[data-carousel-next]');
    let current = slides.findIndex((s) => s.classList.contains('is-active'));
    if (current === -1) current = 0;

    function show(index) {
      slides[current].classList.remove('is-active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('is-active');
    }

    prevBtn?.addEventListener('click', () => show(current - 1));
    nextBtn?.addEventListener('click', () => show(current + 1));
  });
}

/* ---------------- Lead form ---------------- */
function initLeadForm() {
  const form = document.getElementById('leadForm');
  const feedback = document.getElementById('leadFeedback');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = Object.fromEntries(new FormData(form).entries());

    // TODO: reemplazar por el envío real (fetch a un backend, Zapier
    // Webhook, Google Sheets, CRM, etc.) — por ahora solo se valida
    // y se muestra confirmación en pantalla.
    if (!data.nombre || !data.mail || !data.telefono || !data.rut) {
      feedback.textContent = 'Por favor completa todos los campos.';
      return;
    }

    console.log('Lead recibido:', data);
    feedback.textContent = `¡Gracias, ${data.nombre}! Te contactaremos pronto.`;
    form.reset();
  });
}
