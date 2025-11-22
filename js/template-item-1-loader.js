
function formatPrice(value) {
  const formatted = value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  // Remove separator and wrap decimals in span
  return formatted.replace(/([.,])(\d{2})$/, '<span class="price-decimals">$2</span>');
}

function loadConsoleData() {
  const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 horas

  // 🔒 API OFF (temporal para pruebas internas)
  fetch(`https://api.kamzilu.com/api/consolas?v=${Date.now()}`)

  // 🧪 Local test mode
  //fetch(`/data/consolas.json`)
    .then(res => {
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      return res.json();
    })
    .then(data => {
      const path = window.location.pathname.split('/')[3];
      const product = data[path];

      if (product) {
        // === LLENAR DATOS BÁSICOS ===
        const elements = {
          breadcrumb: document.getElementById('breadcrumb-product'),
          name: document.getElementById('product-name'),
          desc: document.getElementById('product-description'),
          img: document.getElementById('product-image-src'),
          brand: document.getElementById('pdp-brand-display'),
          priceList: document.getElementById('price-cards'),
          heroBlock: document.getElementById('hero-price-container'),
          heroPrice: document.getElementById('hero-best-price-val'),
          heroStoreLogo: document.getElementById('hero-store-logo'),
          heroStoreName: document.getElementById('hero-store-name'),
          heroUpdateTime: document.getElementById('hero-update-time'),
          heroLink: document.getElementById('hero-btn-link')
        };

        if (elements.breadcrumb) elements.breadcrumb.textContent = product.name;
        if (elements.name) elements.name.textContent = product.name;
        if (elements.desc) elements.desc.textContent = product.description;
        if (elements.img) elements.img.src = product.image;
        if (elements.brand) elements.brand.textContent = product.brand || "VIDEOJUEGOS";

        if (elements.priceList) {
          elements.priceList.innerHTML = ""; // Limpiar

          const now = new Date();
          const recentPrices = [];
          const outdatedPrices = [];
          const noPrices = [];

          // === CLASIFICACIÓN ===
          product.prices.forEach(p => {
            if (!(typeof p.price === "number" && !isNaN(p.price))) {
              noPrices.push(p);
              return;
            }
            if (p.lastUpdated && (now - new Date(p.lastUpdated) <= RECENT_THRESHOLD_MS)) {
              recentPrices.push(p);
            } else {
              outdatedPrices.push(p);
            }
          });

          // Ordenar: Menor precio primero
          recentPrices.sort((a, b) => a.price - b.price);
          outdatedPrices.sort((a, b) => a.price - b.price);

          const minRecentPrice = recentPrices.length > 0 ? recentPrices[0].price : null;

          // === HERO PRICE (LOGIC) ===
          // Si hay precio reciente, mostramos el bloque HERO
          if (recentPrices.length > 0) {
            const bestOffer = recentPrices[0];
            if (elements.heroBlock) elements.heroBlock.style.display = "grid";
            if (elements.heroPrice) elements.heroPrice.innerHTML = formatPrice(bestOffer.price);

            if (elements.heroStoreLogo) {
              elements.heroStoreLogo.src = bestOffer.logo;
              elements.heroStoreLogo.alt = bestOffer.store;
            }
            if (elements.heroStoreName) elements.heroStoreName.textContent = bestOffer.store;

            if (elements.heroUpdateTime) {
              const timeInfo = getUpdateTimeInfo(bestOffer.lastUpdated);
              elements.heroUpdateTime.textContent = timeInfo.text;
              elements.heroUpdateTime.className = `update-time ${timeInfo.class}`;
            }

            if (elements.heroLink) elements.heroLink.href = bestOffer["link-a"] || bestOffer.link;
          }

          // === GENERAR LISTA (ROWS) ===

          // 1. Recientes (Excluyendo el mejor precio que ya está en el Hero)
          recentPrices.slice(1).forEach(price => {
            const isLowest = price.price === minRecentPrice;
            elements.priceList.appendChild(createPriceRow(price, isLowest, 'recent'));
          });

          // 2. Desactualizados (con separador si aplica)
          if (outdatedPrices.length > 0) {
            if (recentPrices.length > 0) addSeparator(elements.priceList, "Precios anteriores (Podrían haber cambiado)");
            outdatedPrices.forEach(price => {
              elements.priceList.appendChild(createPriceRow(price, false, 'outdated'));
            });
          }

          // 3. Sin Precio
          if (noPrices.length > 0) {
            addSeparator(elements.priceList, "Sin disponibilidad detectada");
            noPrices.forEach(price => {
              elements.priceList.appendChild(createPriceRow(price, false, 'unavailable'));
            });
          }
        }

        // Disparar animaciones de entrada
        if (typeof handleScrollAnimations === "function") handleScrollAnimations();
      }
    })
    .catch(err => console.error("Error:", err));
}

// Helper: Crea el HTML de la fila (Nuevo diseño)
function createPriceRow(price, isLowest, category) {
  const row = document.createElement("div");
  row.className = `price-row ${category}`;
  const link = price["link-a"] || price.link;

  // Texto de tiempo
  const timeInfo = getUpdateTimeInfo(price.lastUpdated, category);
  const updatedText = timeInfo.text;
  const timeClass = timeInfo.class;

  // Formato precio
  const displayPrice = (typeof price.price === 'number') ? `$${formatPrice(price.price)}` : "---";

  row.innerHTML = `
    <div class="col-store">
      <img src="${price.logo}" alt="${price.store}" class="store-logo-img">
      <div class="store-meta">
        <span class="store-name-text">${price.store}</span>
        <span class="update-time ${timeClass}">${updatedText}</span>
      </div>
    </div>
    
    <div class="col-price">
      <span class="price-val-row">
        ${displayPrice} 
        ${isLowest ? '<span class="price-tag best">MEJOR</span>' : ''}
      </span>
    </div>
    
    <div class="col-action">
      <a href="${link}" target="_blank" class="btn-go-store">Ver Tienda &gt;</a>
    </div>
  `;

  return row;
}

function addSeparator(container, text) {
  const div = document.createElement("div");
  div.className = "separator-text";
  div.textContent = text;
  container.appendChild(div);
}

function getUpdateTimeInfo(lastUpdated, category = 'recent') {
  if (category === 'unavailable') {
    return { text: "Sin stock", class: "" };
  }
  if (!lastUpdated) {
    return { text: "Hace tiempo", class: "old" };
  }

  const now = new Date();
  const updated = new Date(lastUpdated);
  const diffMs = now - updated;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 2) {
    return { text: "Justo ahora", class: "fresh" };
  }
  if (diffMins < 60) {
    return { text: `Hace ${diffMins} min`, class: "fresh" };
  }
  if (diffHrs < 4) {
    return { text: `Hace ${diffHrs} h`, class: "fresh" };
  }

  // Mayor de 4 horas
  return { text: "Hace unas horas", class: "old" };
}

// Inicialización
if (document.getElementById("breadcrumb-product")) {
  loadConsoleData();
} else {
  document.addEventListener("consolas-main-loaded", loadConsoleData);
}

// Scroll logic
function handleScrollAnimations() {
  const elements = document.querySelectorAll(".scrollup, .scrollleft, .scrollright, .fadein");
  const vh = window.innerHeight;
  elements.forEach(el => {
    if (el.getBoundingClientRect().top < vh - 50) el.classList.add("visible");
  });
}
window.addEventListener("scroll", () => { setTimeout(handleScrollAnimations, 100); });
