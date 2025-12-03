// =========================================================
// UTILITIES
// =========================================================

function formatPrice(value) {
  if (typeof value !== "number" || isNaN(value)) return "---";

  const formatted = value.toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  return formatted.replace(
    /([.,])(\d{2})$/,
    '<span class="price-decimals">$2</span>'
  );
}

function getUpdateTimeInfo(lastUpdated, category) {
  if (category === "unavailable")
    return { text: "Sin stock", class: "status-unavailable" };

  if (!lastUpdated)
    return { text: "Hace tiempo", class: "status-old" };

  const now = new Date();
  const updated = new Date(lastUpdated);

  if (isNaN(updated.getTime()))
    return { text: "Fecha desconocida", class: "status-unknown" };

  const diffMs = now - updated;
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMins < 5) return { text: "¡Justo ahora!", class: "status-fresh" };
  if (diffMins < 60) return { text: `Hace ${diffMins} min`, class: "status-fresh" };
  if (diffHrs < 24) return { text: `Hace ${diffHrs} h`, class: "status-fresh" };
  if (diffDays >= 1) return { text: `Hace ${diffDays} días`, class: "status-old" };

  return { text: "Hace tiempo", class: "status-old" };
}

// =========================================================
// MAIN LOADER
// =========================================================

async function loadConsoleData() {
  const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

  try {
    const parts = window.location.pathname.split("/").filter(Boolean);
    const productId = parts[parts.length - 2];

    const isLocal =
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1" ||
      location.protocol === "file:";

    const API_URL = isLocal
      ? `/data/consolas.json?v=${Date.now()}`
      : `https://api.kamzilu.com/api/consolas?v=${Date.now()}`;

    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
    const data = await res.json();

    const product = data[productId];
    if (!product) return;

    const ui = {
      breadcrumb: document.getElementById("breadcrumb-product"),
      name: document.getElementById("product-name"),
      desc: document.getElementById("product-description"),
      img: document.getElementById("product-image-src"),
      brand: document.getElementById("pdp-brand-display"),
      priceList: document.getElementById("price-cards"),

      heroBlock: document.getElementById("hero-price-container"),
      heroPrice: document.getElementById("hero-best-price-val"),
      heroStoreLogo: document.getElementById("hero-store-logo"),
      heroStoreName: document.getElementById("hero-store-name"),
      heroUpdateTime: document.getElementById("hero-update-time"),
      heroLink: document.getElementById("hero-btn-link")
    };

    // ----------------------------
    // Datos estáticos
    // ----------------------------
    if (ui.breadcrumb) ui.breadcrumb.textContent = product.name;
    if (ui.name) ui.name.textContent = product.name;
    if (ui.desc) ui.desc.textContent = product.description;
    if (ui.img) ui.img.src = product.image;
    if (ui.brand) ui.brand.textContent = product.brand || "VIDEOJUEGOS";

    // =====================================================
    // PROCESAMIENTO EN UNA SOLA PASADA
    // =====================================================

    const now = new Date();
    const valid = [];
    const unavailable = [];

    for (const p of product.prices) {
      if (typeof p.price === "number" && !isNaN(p.price)) {
        const d = p.lastUpdated ? new Date(p.lastUpdated) : new Date(0);
        p._date = d;
        p._isRecent = now - d <= RECENT_THRESHOLD_MS;
        valid.push(p);
      } else {
        unavailable.push(p);
      }
    }

    valid.sort((a, b) => a.price - b.price);

    const heroItem = valid.length > 0 ? valid[0] : null;

    // =====================================================
    // RENDER HERO
    // =====================================================
    if (heroItem && ui.heroBlock) {
      ui.heroBlock.style.display = "grid";
      ui.heroPrice.innerHTML = formatPrice(heroItem.price);
      ui.heroStoreLogo.src = heroItem.logo;
      ui.heroStoreName.textContent = heroItem.store;
      ui.heroLink.href = heroItem["link-a"] || heroItem.link;

      const cat = heroItem._isRecent ? "recent" : "outdated";
      const info = getUpdateTimeInfo(heroItem.lastUpdated, cat);
      ui.heroUpdateTime.textContent = info.text;
      ui.heroUpdateTime.className = `update-time ${info.class}`;
    } else if (ui.heroBlock) {
      ui.heroBlock.style.display = "none";
    }

    // =====================================================
    // LISTA DE PRECIOS
    // =====================================================
    const list = ui.priceList;
    list.innerHTML = "";

    const listCandidates = valid.filter(p => p !== heroItem);
    const recent = listCandidates.filter(p => p._isRecent);
    const outdated = listCandidates.filter(p => !p._isRecent);

    recent.forEach(p => list.appendChild(createPriceRow(p, "recent")));
    if (outdated.length > 0) addSeparator(list, "Precios anteriores");
    outdated.forEach(p => list.appendChild(createPriceRow(p, "outdated")));

    if (unavailable.length > 0) {
      addSeparator(list, "Sin disponibilidad detectada");
      unavailable.forEach(p =>
        list.appendChild(createPriceRow(p, "unavailable"))
      );
    }

    handleScrollAnimations();
  } catch (err) {
    console.error("🔥 Error Orquestador PDP:", err);
  }
}

// =========================================================
// UI HELPERS
// =========================================================

function createPriceRow(price, category) {
  const row = document.createElement("div");
  row.className = `price-row ${category}`;

  const info = getUpdateTimeInfo(price.lastUpdated, category);
  const link = price["link-a"] || price.link;

  let displayPrice =
    category === "unavailable"
      ? "Agotado"
      : `$${formatPrice(price.price)}`;

  const priceClass =
    category === "outdated" ? "price-val-row old-data" : "price-val-row";

  row.innerHTML = `
    <div class="col-store">
      <img src="${price.logo}" class="store-logo-img">
      <div class="store-meta">
        <span class="store-name-text">${price.store}</span>
        <span class="update-time ${info.class}">${info.text}</span>
      </div>
    </div>

    <div class="col-price">
      <span class="${priceClass}">
        ${displayPrice}
      </span>
    </div>

    <div class="col-action">
      <a href="${link}" target="_blank" class="btn-go-store">Ver ></a>
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

// =========================================================
// SCROLL ANIMATIONS
// =========================================================

let isScrolling = false;

function handleScrollAnimations() {
  const elements = document.querySelectorAll(
    ".scrollup, .scrollleft, .scrollright, .fadein"
  );
  const vh = window.innerHeight;

  elements.forEach(el => {
    if (el.getBoundingClientRect().top < vh - 50)
      el.classList.add("visible");
  });

  isScrolling = false;
}

window.addEventListener("scroll", () => {
  if (!isScrolling) {
    window.requestAnimationFrame(handleScrollAnimations);
    isScrolling = true;
  }
});

// =========================================================
// INIT
// =========================================================

if (document.getElementById("breadcrumb-product")) {
  loadConsoleData();
} else {
  document.addEventListener("consolas-main-loaded", loadConsoleData);
}
