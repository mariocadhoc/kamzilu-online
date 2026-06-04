document.addEventListener("header-loaded", () => {
  const burgerBtn = document.getElementById("burger-btn");
  if (!burgerBtn) return;

  const burgerIcon = burgerBtn.querySelector(".burger-animated-icon");
  const mobileMenu = document.getElementById("header-nav-mobile");

  // Toggle menú móvil y animación
  burgerBtn.addEventListener("click", () => {
    burgerIcon.classList.toggle("open");
    mobileMenu.classList.toggle("show");

    const isExpanded = burgerBtn.getAttribute("aria-expanded") === "true";
    burgerBtn.setAttribute("aria-expanded", !isExpanded);
  });

  // Submenús en móvil (ajustado para múltiples)
  const mobileParents = document.querySelectorAll(".header-mobile-parent");
  mobileParents.forEach(parent => {
    const submenu = parent.nextElementSibling;
    parent.addEventListener("click", () => {
      parent.classList.toggle("open");
      submenu.classList.toggle("show");
    });
  });
});
