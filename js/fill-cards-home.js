document.addEventListener("DOMContentLoaded", async () => {
  try {
    const response = await fetch("/data/consolas.json");
    const data = await response.json();

    document.querySelectorAll(".product-card").forEach(card => {
      const slug = card.dataset.slug;
      const item = data[slug];
      if (!item || !item.prices) return;

      // Filtra precios válidos y busca el menor
      const precios = item.prices
        .map(p => p.price)
        .filter(p => p !== null && !isNaN(p));

      if (!precios.length) return;

      const minPrice = Math.min(...precios).toLocaleString("es-MX", {
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
        <a href="${href}" class="card-link">
          <img src="${image}" alt="${name}">
          <h3>${name}</h3>
          <p class="price">Precio más bajo: ${minPrice}</p>
        </a>
      `;
    });
  } catch (error) {
    console.error("Error cargando consolas:", error);
  }
});
