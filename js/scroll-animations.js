document.addEventListener("DOMContentLoaded", () => {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, { threshold: 0.2 }); // 0.2 = activa cuando el 20% del elemento entra en pantalla

  document.querySelectorAll(".fadein, .scrollup, .zoom").forEach(el => observer.observe(el));

  // Banner inicial (aparece aunque ya esté visible desde el inicio)
  const heroBanner = document.querySelector(".hero-banner");
  if (heroBanner) {
    setTimeout(() => heroBanner.classList.add("visible"), 300);
  }
});
