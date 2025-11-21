// Script de animaciones Hero - Clean Tech
// Mantenemos efectos sutiles, eliminamos la complejidad de los emojis flotantes antiguos

document.addEventListener('DOMContentLoaded', () => {
  // Efecto de aparición suave para elementos con clase fadein
  const fadeElements = document.querySelectorAll('.fadein');
  
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px"
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  fadeElements.forEach(el => observer.observe(el));

  // Animación opcional para el "Highlight" del título
  const highlights = document.querySelectorAll('.highlight-text');
  highlights.forEach((el, index) => {
    setTimeout(() => {
      el.style.opacity = '1'; // Asegurar visibilidad si se manejara con opacidad
    }, 500 + (index * 300));
  });
});
