// Listener único con event delegation
document.addEventListener('click', e => {
  const link = e.target.closest('[data-store]');
  if (!link) return;
  
  // Configurar atributos del link (lazy setup)
  const dataLink = link.dataset.link;
  if (dataLink && !link.href) {
    link.href = dataLink;
    link.rel = 'nofollow noopener';
    link.target = '_blank';
  }
  
  // Tracking con gtag
  if (typeof gtag === 'function') {
    gtag('event', 'click_tienda', {
      event_category: 'Salida',
      event_label: link.dataset.store || 'desconocido',
      value: 1,
      product_slug: link.dataset.product || '',
      location: link.dataset.location || ''
    });
  }
});
