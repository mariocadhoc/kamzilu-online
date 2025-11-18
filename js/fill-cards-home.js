document.addEventListener("DOMContentLoaded", async () => {
  // Define el umbral de tiempo para considerar un precio "reciente" (24 horas)
  const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

  try {
    const response = await fetch(`https://api.kamzilu.com/api/consolas?v=${Date.now()}`);
    const data = await response.json();

    document.querySelectorAll(".product-card").forEach(card => {
      const slug = card.dataset.slug;
      const item = data[slug];

      if (!item || !item.prices) return;

      const now = new Date();

      // ========================================
      // FILTRAR SOLO PRECIOS RECIENTES
      // ========================================
      const recentPrices = item.prices.filter(p => {
        // Debe tener precio válido
        if (!(typeof p.price === "number" && !isNaN(p.price))) {
          return false;
        }

        // Debe tener fecha de actualización
        if (!p.lastUpdated) {
          return false;
        }

        // Verificar que sea reciente
        const lastUpdate = new Date(p.lastUpdated);
        const diffMs = now - lastUpdate;

        return diffMs <= RECENT_THRESHOLD_MS;
      });

      // Si no hay precios recientes, no mostrar en home
      if (!recentPrices.length) {
        card.style.display = "none"; // Opcional: ocultar productos sin precios recientes
        return;
      }

      // Calcular el precio mínimo solo de los precios recientes
      const minPrice = Math.min(...recentPrices.map(p => p.price)).toLocaleString("es-MX", {
        style: "currency",
        currency: "MXN",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });

      const brand = item.brand?.toLowerCase() || "otros";
      const image = item.image;
      const name = item.name;
      const href = `/consolas/${brand}/${slug}/index.html`;

      card.innerHTML = `
        <a href="${href}">
          <img src="${image}" alt="${name}">
          <h3>${name}</h3>
          <p class="price-badge">Precio más bajo: ${minPrice}</p>
        </a>
      `;
    });

  } catch (error) {
    console.error("Error cargando consolas:", error);
  }
});
