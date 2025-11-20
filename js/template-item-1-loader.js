// ========================================
// CONFIGURACIÓN GLOBAL
// ========================================
const CONFIG = {
  RECENT_THRESHOLD_MS: 24 * 60 * 60 * 1000 // 24 horas
};

// ========================================
// HELPERS
// ========================================
function formatPrice(value) {
  const hasDecimals = !Number.isInteger(value);
  return value.toLocaleString("es-MX", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0
  });
}

function getUpdatedText(dateString) {
  if (!dateString) return "Sin datos recientes";

  const last = new Date(dateString);
  const now = new Date();
  const diffMs = now - last;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHrs < 1) {
    const diffMin = Math.floor(diffMs / (1000 * 60));
    return `Actualizado hace ${diffMin} min`;
  }
  if (diffHrs < 24) return `Actualizado hace ${diffHrs} h`;
  if (diffHrs < 48) return "Ayer";

  const diffDays = Math.floor(diffHrs / 24);
  return `Hace ${diffDays} días`;
}

// ========================================
// CLASIFICACIÓN DE PRECIOS
// ========================================
function classifyPrices(prices, now) {
  const recent = [];
  const noPrice = [];

  prices.forEach(p => {
    const valid = typeof p.price === "number" && !isNaN(p.price);

    // Sin precio → directo a noPrice
    if (!valid) {
      noPrice.push(p);
      return;
    }

    // Con precio → verificar frescura
    if (p.lastUpdated) {
      const diff = now - new Date(p.lastUpdated);
      if (diff <= CONFIG.RECENT_THRESHOLD_MS) {
        recent.push(p);
        return;
      }
    }

    // Precio viejo → noPrice
    noPrice.push(p);
  });

  return { recent, noPrice };
}

// ========================================
// TARJETAS (UI COMPONENT)
// ========================================
function createPriceCard(price, isLowest, type) {
  const card = document.createElement("div");
  const link = price["link-a"] || price.link;

  card.className =
    type === "no-price" ?
      "price-card unavailable" :
      (isLowest ? "price-card lowest" : "price-card");

  if (type === "no-price") {
    card.innerHTML = `
      <div class="price-left">
        <img src="${price.logo}" alt="${price.store}">
        <p class="price-updated">La tienda no proporcionó su precio en nuestro último escaneo</p>
      </div>
      <a href="${link}" target="_blank" class="price-right-link unavailable">
        <div class="price-inner-box">
          <span class="price-value unavailable">Precio no disponible</span>
          <span class="view-button">Ir a tienda ></span>
        </div>
      </a>
    `;
    return card;
  }

  const formatted = `$ ${formatPrice(price.price)}`;
  const updated = getUpdatedText(price.lastUpdated);

  card.innerHTML = `
    <div class="price-left">
      <img src="${price.logo}" alt="${price.store}">
      <p class="price-updated">${updated}</p>
    </div>
    <a href="${link}" target="_blank" class="price-right-link">
      <div class="price-inner-box">
        <span class="price-value ${isLowest ? "lowest" : ""}">
          ${formatted}${isLowest ? ' <span class="lowest-text">🔥 Precio más bajo</span>' : ''}
        </span>
        <span class="view-button">Ver ></span>
      </div>
    </a>
  `;
  return card;
}

// ========================================
// SECCIÓN (para no-price)
// ========================================
function renderSection(title, items, container) {
  if (items.length === 0) return;

  const sep = document.createElement("hr");
  sep.className = "price-separator";
  container.appendChild(sep);

  const h = document.createElement("h3");
  h.className = "price-section-title no-price";
  h.textContent = title;
  container.appendChild(h);

  items.forEach(p => container.appendChild(createPriceCard(p, false, "no-price")));
}

// ========================================
// CARGA PRINCIPAL
// ========================================
function loadConsoleData() {
  const now = new Date();
  const slug = window.location.pathname.split("/")[3];

  fetch(`https://api.kamzilu.com/api/consolas?v=${Date.now()}`)
    .then(r => r.json())
    .then(data => {
      const product = data[slug];
      if (!product) return;

      // Datos básicos
      document.getElementById("breadcrumb-product").textContent = product.name;
      document.getElementById("product-name").textContent = product.name;
      document.getElementById("product-image-src").src = product.image;
      document.getElementById("product-description").textContent = product.description;

      const priceCards = document.getElementById("price-cards");
      priceCards.innerHTML = "";

      // Clasificación
      const { recent, noPrice } = classifyPrices(product.prices, now);

      // Recientes → ordenados
      recent.sort((a, b) => a.price - b.price);
      const lowest = recent.length ? recent[0].price : null;

      recent.forEach(p =>
        priceCards.appendChild(createPriceCard(p, p.price === lowest, "recent"))
      );

      // No price
      renderSection(
        "🕓 Las siguientes tiendas no proporcionaron su precio en nuestro último escaneo:",
        noPrice,
        priceCards
      );

      handleScrollAnimations();
    })
    .catch(() => {
      const n = document.getElementById("product-name");
      if (n) n.textContent = "Error al cargar el producto";
    });
}

// ========================================
// ANIMACIONES
// ========================================
function handleScrollAnimations() {
  const els = document.querySelectorAll(
    ".scrollup, .scrolldown, .scrollleft, .scrollright, .fadein, .zoomin"
  );
  const vh = window.innerHeight;

  els.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < vh - 80) el.classList.add("visible");
  });
}

// ========================================
// INIT
// ========================================
if (document.getElementById("breadcrumb-product")) {
  loadConsoleData();
} else {
  document.addEventListener("consolas-main-loaded", loadConsoleData);
}

window.addEventListener("load", handleScrollAnimations);
window.addEventListener("scroll", () => {
  clearTimeout(window.__scrollTimeout);
  window.__scrollTimeout = setTimeout(handleScrollAnimations, 100);
});
