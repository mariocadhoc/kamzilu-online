document.addEventListener("DOMContentLoaded", async () => {
  const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

  try {
    // 🔒 API OFF (temporal para pruebas internas)
     const response = await fetch(`https://api.kamzilu.com/api/consolas?v=${Date.now()}`);

    // 🧪 Local test mode
    //const response = await fetch(`/data/consolas.json`);

    const data = await response.json();


    document.querySelectorAll(".product-card").forEach(card => {
      const slug = card.dataset.slug;
      const item = data[slug];

      if (!item || !item.prices) {
        // Si no hay datos, opcionalmente ocultar o mostrar skeleton
        card.style.display = "none";
        return;
      }

      const now = new Date();

      // Filtrar precios recientes
      const recentPrices = item.prices.filter(p => {
        if (!(typeof p.price === "number" && !isNaN(p.price))) return false;
        if (!p.lastUpdated) return false;
        const lastUpdate = new Date(p.lastUpdated);
        return (now - lastUpdate) <= RECENT_THRESHOLD_MS;
      });

      if (!recentPrices.length) {
        card.style.display = "none";
        return;
      }

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

      // Nueva estructura HTML Tech
      card.innerHTML = `
        <a href="${href}">
          <div class="deal-badge">Oferta</div>
          <div class="card-image-wrapper">
            <img src="${image}" alt="${name}" loading="lazy">
          </div>
          <h3>${name}</h3>
          <div class="price-container">
            <span class="price-label">Mejor Precio</span>
            <span class="price-value">${minPrice}</span>
          </div>
        </a>
      `;
    });

  } catch (error) {
    console.error("Error cargando consolas:", error);
  }
});
