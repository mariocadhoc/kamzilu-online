function loadConsoleData() {
  fetch(`/data/consolas.json?v=${Date.now()}`)
    .then(res => {
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const path = window.location.pathname.split('/')[3];
      const product = data[path];

      if (product) {
        const breadcrumb = document.getElementById('breadcrumb-product');
        const nameEl = document.getElementById('product-name');
        const imgEl = document.getElementById('product-image-src');
        const descEl = document.getElementById('product-description');
        const lastUpdatedEl = document.getElementById('last-updated');
        const priceCards = document.getElementById('price-cards');

        if (breadcrumb) breadcrumb.textContent = product.name;
        if (nameEl) nameEl.textContent = product.name;
        if (imgEl) imgEl.src = product.image;
        if (descEl) descEl.textContent = product.description;

        // --- Fecha ---
        const scrapeDate = new Date(product.lastUpdated);
        const now = new Date();
        const diffMs = now - scrapeDate;
        const diffMins = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        let timeAgo = "";
        if (diffDays > 0) timeAgo = `hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
        else if (diffHours > 0) timeAgo = `hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
        else if (diffMins > 0) timeAgo = `hace ${diffMins} minuto${diffMins > 1 ? "s" : ""}`;
        else timeAgo = "hace unos segundos";

        const options = {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
          hour: "numeric",
          minute: "2-digit"
        };
        const formattedDate = scrapeDate.toLocaleDateString("es-MX", options);
        if (lastUpdatedEl)
          lastUpdatedEl.textContent = `Actualizado ${timeAgo}: ${formattedDate}`;
        // --- Fin fecha ---

        if (priceCards) {
          priceCards.innerHTML = ""; // limpia previo

          const availableStores = product.prices.filter(
            p => typeof p.price === "number" && !isNaN(p.price)
          );
          const unavailableStores = product.prices.filter(
            p => !(typeof p.price === "number" && !isNaN(p.price))
          );

          const sortedAvailable = [...availableStores].sort((a, b) => a.price - b.price);
          const minPrice = Math.min(...sortedAvailable.map(p => p.price));

          // === Sección 1: Precios disponibles ===
          sortedAvailable.forEach(price => {
            const isLowest = price.price === minPrice;
            const card = document.createElement("div");
            card.className = isLowest ? "price-card lowest" : "price-card";
            const priceClass = isLowest ? "price-value lowest" : "price-value";
            const formattedPrice = `$ ${price.price.toLocaleString("es-MX")}`;
            const finalLink = price["link-a"] || price.link;

            card.innerHTML = `
              <div class="price-left">
                <img src="${price.logo}" alt="${price.store}">
              </div>
              <a href="${finalLink}" target="_blank" rel="noopener noreferrer" class="price-right-link">
                <div class="price-inner-box">
                  <span class="${priceClass}">
                    ${formattedPrice}${isLowest ? ' <span class="lowest-text">🔥 Precio más bajo</span>' : ''}
                  </span>
                  <span class="view-button">Ver ></span>
                </div>
              </a>
            `;
            priceCards.appendChild(card);
          });

          // === Sección 2: Tiendas sin precio ===
          if (unavailableStores.length > 0) {
            const separator = document.createElement("hr");
            separator.className = "price-separator";
            priceCards.appendChild(separator);

            const unavailableHeader = document.createElement("h3");
            unavailableHeader.textContent =
              "🕓 Las siguientes tiendas no mostraron su precio en nuestro último escaneo:";
            unavailableHeader.className = "price-section-title no-price";
            priceCards.appendChild(unavailableHeader);

            unavailableStores.forEach(price => {
              const card = document.createElement("div");
              card.className = "price-card unavailable";
              card.innerHTML = `
                <div class="price-left">
                  <img src="${price.logo}" alt="${price.store}">
                </div>
                <a href="${price.link}" target="_blank" rel="noopener noreferrer" class="price-right-link unavailable">
                  <div class="price-inner-box">
                    <span class="price-value unavailable">Precio en tienda no disponible</span>
                    <span class="view-button">Ir a tienda ></span>
                  </div>
                </a>
              `;
              priceCards.appendChild(card);
            });
          }
        }

        // 🔁 Actualiza animaciones
        if (typeof handleScrollAnimations === "function") {
          handleScrollAnimations();
        }
      } else {
        const nameEl = document.getElementById('product-name');
        if (nameEl) nameEl.textContent = "Producto no encontrado";
      }
    })
    .catch(err => {
      console.error("Error al cargar datos:", err);
      const nameEl = document.getElementById('product-name');
      if (nameEl) nameEl.textContent = "Error al cargar el producto";
    });
}

// === Carga inicial ===
if (document.getElementById("breadcrumb-product")) {
  loadConsoleData();
} else {
  document.addEventListener("consolas-main-loaded", loadConsoleData);
}

// === Animaciones scroll ===
function handleScrollAnimations() {
  const elements = document.querySelectorAll(
    ".scrollup, .scrolldown, .scrollleft, .scrollright, .fadein, .zoomin"
  );
  const vh = window.innerHeight || document.documentElement.clientHeight;

  elements.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh - 80) el.classList.add("visible");
  });
}

// 🔄 Scroll optimizado con throttle simple
let scrollTimeout;
window.addEventListener("scroll", () => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(handleScrollAnimations, 100);
});
window.addEventListener("load", handleScrollAnimations);
