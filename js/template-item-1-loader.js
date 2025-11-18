function loadConsoleData() {
  // Define el umbral de tiempo para considerar un precio "reciente" (en milisegundos)
  // 24 horas = 24 * 60 * 60 * 1000
  const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 horas

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
          
          const now = new Date();

          // ========================================
          // CLASIFICACIÓN EN 3 CATEGORÍAS
          // ========================================
          const recentPrices = [];     // Precios con lastUpdated reciente
          const outdatedPrices = [];   // Precios con lastUpdated antiguo o null pero con precio válido
          const noPrices = [];         // Sin precio (null)

          product.prices.forEach(p => {
            // Categoría 3: Sin precio
            if (!(typeof p.price === "number" && !isNaN(p.price))) {
              noPrices.push(p);
              return;
            }

            // Tiene precio válido, ahora verificar fecha
            if (p.lastUpdated) {
              const lastUpdate = new Date(p.lastUpdated);
              const diffMs = now - lastUpdate;

              if (diffMs <= RECENT_THRESHOLD_MS) {
                // Categoría 1: Precio reciente
                recentPrices.push(p);
              } else {
                // Categoría 2: Precio desactualizado (fecha vieja)
                outdatedPrices.push(p);
              }
            } else {
              // Categoría 2: Sin fecha de actualización = desactualizado
              outdatedPrices.push(p);
            }
          });

          // Ordenar precios recientes por precio (menor a mayor)
          const sortedRecent = [...recentPrices].sort((a, b) => a.price - b.price);
          const minRecentPrice = sortedRecent.length > 0 ? Math.min(...sortedRecent.map(p => p.price)) : null;

          // ========================================
          // SECCIÓN 1: PRECIOS ACTUALIZADOS RECIENTEMENTE
          // ========================================
          if (sortedRecent.length > 0) {
            sortedRecent.forEach(price => {
              const isLowest = price.price === minRecentPrice;
              const card = createPriceCard(price, isLowest, 'recent');
              priceCards.appendChild(card);
            });
          }

          // ========================================
          // SECCIÓN 2: PRECIOS DESACTUALIZADOS
          // ========================================
          if (outdatedPrices.length > 0) {
            // Separador visual
            const separator = document.createElement("hr");
            separator.className = "price-separator";
            priceCards.appendChild(separator);

            // Encabezado de sección
            const outdatedHeader = document.createElement("h3");
            outdatedHeader.textContent = 
              "⏰ Las siguientes tiendas no actualizaron su precio recientemente, pero suelen tener precios competitivos";
            outdatedHeader.className = "price-section-title outdated";
            priceCards.appendChild(outdatedHeader);

            // Ordenar por precio
            const sortedOutdated = [...outdatedPrices].sort((a, b) => a.price - b.price);
            
            sortedOutdated.forEach(price => {
              const card = createPriceCard(price, false, 'outdated');
              priceCards.appendChild(card);
            });
          }

          // ========================================
          // SECCIÓN 3: SIN PRECIO DISPONIBLE
          // ========================================
          if (noPrices.length > 0) {
            // Separador visual
            const separator = document.createElement("hr");
            separator.className = "price-separator";
            priceCards.appendChild(separator);

            // Encabezado de sección
            const noPriceHeader = document.createElement("h3");
            noPriceHeader.textContent =
              "🕓 Las siguientes tiendas no proporcionaron su precio en nuestro último escaneo:";
            noPriceHeader.className = "price-section-title no-price";
            priceCards.appendChild(noPriceHeader);

            noPrices.forEach(price => {
              const card = createPriceCard(price, false, 'no-price');
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

  // ========================================
  // FUNCIÓN AUXILIAR PARA CREAR TARJETAS
  // ========================================
  function createPriceCard(price, isLowest, category) {
    const card = document.createElement("div");
    const finalLink = price["link-a"] || price.link;

    // Determinar clase CSS según categoría
    let cardClass = "price-card";
    if (category === 'recent' && isLowest) {
      cardClass += " lowest"; // Borde amarillo solo para el más bajo de los recientes
    } else if (category === 'outdated') {
      cardClass += " outdated"; // Clase especial para desactualizados
    } else if (category === 'no-price') {
      cardClass += " unavailable"; // Clase especial para sin precio (mantienes tu clase original)
    }

    card.className = cardClass;

    // ========================================
    // CASO: Sin precio (null)
    // ========================================
    if (category === 'no-price') {
      card.innerHTML = `
        <div class="price-left">
          <img src="${price.logo}" alt="${price.store}">
          <p class="price-updated">La tienda no proporcionó su precio en nuestro último escaneo</p>
        </div>
        <a href="${finalLink}" target="_blank" rel="noopener noreferrer" class="price-right-link unavailable">
          <div class="price-inner-box">
            <span class="price-value unavailable">Precio no disponible</span>
            <span class="view-button">Ir a tienda ></span>
          </div>
        </a>
      `;
      return card;
    }

    // ========================================
    // CASO: Con precio (recent u outdated)
    // ========================================
    const formattedPrice = `$ ${price.price.toLocaleString("es-MX")}`;
    const priceClass = (category === 'recent' && isLowest) ? "price-value lowest" : "price-value";

    // Calcular texto de actualización
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

    // Agregar indicador visual para precios desactualizados
    const warningIcon = category === 'outdated' ? '⚠️ ' : '';
    const updatedClass = category === 'outdated' ? 'price-updated outdated-warning' : 'price-updated';

    card.innerHTML = `
      <div class="price-left">
        <img src="${price.logo}" alt="${price.store}">
        <p class="${updatedClass}">${warningIcon}${updatedText}</p>
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

    return card;
  }
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
