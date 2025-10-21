function loadConsoleData() {
  fetch(`/data/consolas.json?v=${new Date().toISOString().slice(0, 13)}`)
    .then(res => res.json())
    .then(data => {
      const path = window.location.pathname.split('/')[3];
      const product = data[path];

      if (product) {
        document.getElementById('breadcrumb-product').textContent = product.name;
        document.getElementById('product-name').textContent = product.name;
        document.getElementById('product-image-src').src = product.image;
        document.getElementById('product-description').textContent = product.description;

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

        const options = { day: "2-digit", month: "2-digit", year: "2-digit", hour: "numeric", minute: "2-digit" };
        const formattedDate = scrapeDate.toLocaleDateString("es-MX", options);

        document.getElementById('last-updated').textContent = `Actualizado ${timeAgo}: ${formattedDate}`;
        // --- Fin fecha ---

        const priceCards = document.getElementById('price-cards');
        priceCards.innerHTML = ""; // limpia previo

        // --- Clasificación de tiendas ---
        const availableStores = product.prices.filter(p =>
          typeof p.price === 'number' && !isNaN(p.price)
        );

        const unavailableStores = product.prices.filter(p =>
          !(typeof p.price === 'number' && !isNaN(p.price))
        );

        const sortedAvailable = [...availableStores].sort((a, b) => a.price - b.price);
        const lowestAvailable = sortedAvailable[0];

        // === Sección 1: Precios disponibles ===
        // Encuentra el precio más bajo
        const minPrice = Math.min(...sortedAvailable.map(p => p.price));

        // Recorre tiendas con el formato de dinero y borde amarillo
        sortedAvailable.forEach(price => {
          const isLowest = price.price === minPrice;

          const card = document.createElement('div');
          card.className = isLowest ? 'price-card lowest' : 'price-card';
          const priceClass = isLowest ? 'price-value lowest' : 'price-value';

          // Formato "$ XX,XXX"
          const formattedPrice = `$ ${price.price.toLocaleString("es-MX")}`;

          card.innerHTML = `
            <div class="price-left">
              <img src="${price.logo}" alt="${price.store}">
            </div>
            <a href="${price.link}" target="_blank" rel="noopener noreferrer" class="price-right-link">
              <div class="price-inner-box">
                <span class="${priceClass}">
                  ${formattedPrice}${isLowest ? ' ✅ <br>Precio más bajo' : ''}
                </span>
                <span class="view-button">Ver ></span>
              </div>
            </a>
          `;
          priceCards.appendChild(card);
        });


        // === Sección 2: Tiendas sin precio ===
        if (unavailableStores.length > 0) {
          const separator = document.createElement('hr');
          separator.className = "price-separator";
          priceCards.appendChild(separator);

          const unavailableHeader = document.createElement('h3');
          unavailableHeader.textContent = "🕓 Las siguientes tiendas no mostraron su precio en nuestro último escaneo:";
          unavailableHeader.className = "price-section-title no-price";
          priceCards.appendChild(unavailableHeader);

          unavailableStores.forEach(price => {
            const card = document.createElement('div');
            card.className = 'price-card unavailable';
            card.innerHTML = `
              <div class="price-left">
                <img src="${price.logo}" alt="${price.store}">
              </div>
              <a href="${price.link}" target="_blank" rel="noopener noreferrer" class="price-right-link unavailable">
                <div class="price-inner-box">
                  <span class="price-value unavailable">Precio en tienda No Disponible</span>
                  <span class="view-button">Ir a tienda ></span>
                </div>
              </a>
            `;
            priceCards.appendChild(card);
          });
        }

      } else {
        document.getElementById('product-name').textContent = 'Producto no encontrado';
      }
    });
}

if (document.getElementById('breadcrumb-product')) {
  loadConsoleData();
} else {
  document.addEventListener('consolas-main-loaded', loadConsoleData);
}
