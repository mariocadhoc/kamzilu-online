function loadConsoleData() {
  fetch(`https://api.kamzilu.com/api/consolas?v=${Date.now()}`)
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
        const priceCards = document.getElementById('price-cards');

        if (breadcrumb) breadcrumb.textContent = product.name;
        if (nameEl) nameEl.textContent = product.name;
        if (imgEl) imgEl.src = product.image;
        if (descEl) descEl.textContent = product.description;

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

            // Cálculo del texto de actualización
            let updatedText = "Sin datos recientes";
            if (price.lastUpdated) {
              const last = new Date(price.lastUpdated);
              const now = new Date();
              const diffMs = now - last;
              const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

              if (diffHrs < 1) {
                const diffMin = Math.floor(diffMs / (1000 * 60));
                updatedText = `Actualizado hace ${diffMin} min`;
              } else if (diffHrs < 24) {
                updatedText = `Actualizado hace ${diffHrs} h`;
              } else if (diffHrs < 48) {
                updatedText = "Ayer";
              } else {
                const diffDays = Math.floor(diffHrs / 24);
                updatedText = `Hace ${diffDays} días`;
              }
            }

            card.innerHTML = `
              <div class="price-left">
                <img src="${price.logo}" alt="${price.store}">
                <p class="price-updated">${updatedText}</p>
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
              "🕓 Las siguientes tiendas no proporcionaron su precio en nuestro último escaneo:";
            unavailableHeader.className = "price-section-title no-price";
            priceCards.appendChild(unavailableHeader);

            unavailableStores.forEach(price => {
              const card = document.createElement("div");
              card.className = "price-card unavailable";
              card.innerHTML = `
                <div class="price-left">
                  <img src="${price.logo}" alt="${price.store}">
                  <p class="price-updated">La tienda no proporcionó su precio en nuestro último escaneo</p>
                </div>
                <a href="${price.link}" target="_blank" rel="noopener noreferrer" class="price-right-link unavailable">
                  <div class="price-inner-box">
                    <span class="price-value unavailable">Precio no disponible</span>
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
