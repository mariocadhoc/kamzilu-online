document.addEventListener("DOMContentLoaded", () => {
  // === Cargar componentes ===
  const includes = [
    { id: "header", url: "/components/header.html", event: "header-loaded" },
    { id: "footer", url: "/components/footer.html", event: "footer-loaded" },
    { id: "consolas_main", url: "/components/consolas_main.html", event: "consolas-main-loaded" }  ];

  includes.forEach(({ id, url, event }) => {
    const el = document.getElementById(id);
    if (el) {
      fetch(url)
        .then(res => res.text())
        .then(html => {
          el.innerHTML = html;
          document.dispatchEvent(new Event(event));
        });
    }
  });

  // === Animaciones con scroll ===
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target); // solo se anima una vez
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.scrollup, .scrolldown, .scrollleft, .scrollright, .fadein, .zoom').forEach(el => {
    observer.observe(el);
  });
});

// === Efecto imán ===
document.addEventListener("header-loaded", () => {
  if (window.innerWidth >= 768) {
    const intensity = 0.3;

    // Función para aplicar el efecto imán SOLO a los enlaces principales
    function applyMagnetEffect() {
      const mainLinks = document.querySelectorAll(".header-nav-desktop a.nav-link:not(.header-submenu .nav-link)"); // Excluye submenú
      
      mainLinks.forEach(link => {
        link.addEventListener('mousemove', (e) => {
          const rect = link.getBoundingClientRect();
          const x = e.clientX - rect.left - rect.width / 2;
          const y = e.clientY - rect.top - rect.height / 2;
          link.style.transform = `translate(${x * intensity}px, ${y * intensity}px)`;
        });

        link.addEventListener('mouseleave', () => {
          link.style.transform = 'translate(0, 0)';
        });
      });
    }

    applyMagnetEffect(); // Aplica solo a enlaces principales
  }
});

