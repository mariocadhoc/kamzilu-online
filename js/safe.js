document.addEventListener('copy', function (e) {
  const selection = window.getSelection();
  const text = selection.toString();
  const article = document.getElementById('que-es-un-render');

  if (article && selection.anchorNode && article.contains(selection.anchorNode)) {
    const url = '\n\nFuente: www.arqing-mexico.com';
    const modified = text + url;
    e.clipboardData.setData('text/plain', modified);
    e.preventDefault();

    if (typeof gtag === 'function') {
      gtag('event', 'Texto_copiado', {
        event_category: 'Interacción',
        event_label: '¿Qué es un render?',
        value: 1
      });
    }
  }
});