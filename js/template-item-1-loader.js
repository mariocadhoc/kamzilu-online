// =========================================================
// UTILITIES
// =========================================================

// TIENDAS DE ALTA FRECUENCIA (Tier 1)
const HIGH_FREQ_STORES = ["Amazon", "MercadoLibre", "Walmart"];

function getHighFreqBadge(storeName) {
  if (HIGH_FREQ_STORES.includes(storeName)) {
    // Usamos data-tooltip para que CSS lo pueda leer sin conflicto
    return ` <span class="freq-badge" data-tooltip="⚡️ El precio de esta tienda cambia varias veces al día." style="cursor: help; font-size: 1.1em;">⚡</span>`;
  }
  return "";
}

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

/**
 * Reescribe en relativo la marca de tiempo de la frase GEO estática.
 *
 * El build escribe esa frase con fecha ABSOLUTA ("según la última lectura del
 * 27 de agosto de 2026 a las 17:30") porque el HTML generado vive hasta 24h y
 * un "hace 1 h" horneado envejece mal: a las pocas horas afirma algo falso,
 * tanto para el lector como para una IA que cite la página. Aquí, ya con JS y
 * con la hora real del visitante, se cambia a la forma relativa de siempre.
 * Si no hay JS, la fecha absoluta se queda — nunca caduca.
 */
function refreshGeoSentenceStamp(lastUpdated, category) {
  const el = document.getElementById("pdp-geo-price-sentence");
  if (!el) return;

  const stamp = el.querySelector("time");
  if (!stamp) return;

  const iso = el.dataset.updated || lastUpdated;
  if (!iso) return;

  const info = getUpdateTimeInfo(iso, category);
  if (!info || !info.text) return;

  stamp.textContent = info.text.toLowerCase();
  stamp.setAttribute("datetime", iso);

  // "según la última lectura del hace 3 h" no se lee bien: con forma relativa
  // sobra el artículo que el build dejó antes del <time>.
  const before = stamp.previousSibling;
  if (before && before.nodeType === Node.TEXT_NODE) {
    before.textContent = before.textContent.replace(/\sdel\s*$/, " ");
  }
}

function getUpdateTimeInfo(lastUpdated, category) {
  if (category === "unavailable")
    return { text: "Podría no haber en stock", class: "status-unavailable" };

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

  // --- LÓGICA HUMANIZADA ---
  if (diffMins < 5) return { text: "¡Justo ahora!", class: "status-fresh" };
  if (diffMins < 60) return { text: `Hace ${diffMins} min`, class: "status-fresh" };
  if (diffHrs < 24) return { text: `Hace ${diffHrs} h`, class: "status-fresh" };

  // Manejo de días
  if (diffDays === 1) return { text: "Ayer", class: "status-old" };
  if (diffDays < 7) return { text: `Hace ${diffDays} días`, class: "status-old" };

  // Manejo de semanas y meses
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return { text: `Hace ${weeks} sem`, class: "status-old" };
  }

  const months = Math.floor(diffDays / 30);
  return { text: `Hace ${months} ${months === 1 ? 'mes' : 'meses'}`, class: "status-old" };
}

// =========================================================
// MAIN LOADER
// =========================================================

async function loadConsoleData() {
  // El scraper más lento (Coppel) actualiza cada 12h como máximo (ver
  // backend/scrapers/core/store_config.py). 48h = 4x ese intervalo: da
  // margen de sobra para un ciclo fallido, un reintento, o un fin de semana
  // lento, sin dejar pasar semanas de datos congelados como "recientes".
  // Antes esto eran 7 días — una tienda podía llevar 6 días completos rota
  // y aun así contar como "reciente" aquí (ni siquiera se le ponía la
  // etiqueta de viejo), justo el problema que se quería evitar.
  const RECENT_THRESHOLD_MS = 48 * 60 * 60 * 1000;

  try {
    function getSlug() {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts[parts.length - 1].includes(".html")) parts.pop();
      return parts[parts.length - 1];
    }

    const productId = getSlug();

    // La categoría sale del primer segmento de la URL (/consolas/… o
    // /gift-cards/…) mediante el registro compartido en js/catalogs.js, que
    // también resuelve si toca pegarle a la API en vivo o al JSON local.
    const catalog = window.KamziluCatalogs
      ? (window.KamziluCatalogs.fromPath() || window.KamziluCatalogs.byId("consolas"))
      : null;
    if (!catalog) return;

    const res = await fetch(window.KamziluCatalogs.sourceUrl(catalog));
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
    if (ui.img) {
      ui.img.src = product.image;
      ui.img.alt = product.name;

      // Configuración de optimización de imágenes (PDP)
      const imgConfig = {
        "nintendo-switch-2": {
          w: 1244, h: 1278, renderMobile: 300,
          mobileSrc: "/img/consolas/nintendo/nintendo-switch-2-mobile.webp"
        },
        "playstation-5-slim-blanco-estandar-1tb": {
          w: 1500, h: 1234, renderMobile: 380,
          mobileSrc: "/img/consolas/playstation/ps5-slim-pack-2-juegos-std-mobile.webp"
        },
        "playstation-5-digital-1tb-astrobot-gt7": {
          w: 1500, h: 1278, renderMobile: 370,
          mobileSrc: "/img/consolas/playstation/playstation-5-digital-1tb-astrobot-gt7-mobile.webp"
        },
        "nintendo-switch-oled-blanco": {
          w: 1110, h: 1436, renderMobile: 240,
          mobileSrc: "/img/consolas/nintendo/nintendo-switch-oled-white-joy-con-std-edition-internacional-mobile.webp"
        },
        "xbox-series-x-negro-1tb": {
          w: 1046, h: 1500, renderMobile: 220,
          mobileSrc: "/img/consolas/xbox/xbox-series-x-1tb-internacional-mobile.webp"
        }
      };

      if (imgConfig[productId]) {
        const cfg = imgConfig[productId];
        ui.img.srcset = `${cfg.mobileSrc} 400w, ${product.image} ${cfg.w}w`;
        ui.img.sizes = `(max-width: 600px) ${cfg.renderMobile}px, ${cfg.w}px`;
        ui.img.width = cfg.w;
        ui.img.height = cfg.h;
      }

      ui.img.onload = () => {
        ui.img.style.display = "block";
        const sk = document.getElementById("product-image-skeleton");
        if (sk) sk.remove();
      };
    }
    if (ui.brand) {
      ui.brand.textContent = product.denomination || product.brand || catalog.labelSingular;
    }

    // =====================================================
    // PROCESAMIENTO
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

    // El "hero" (el precio grande y prominente) debe ser el más barato entre
    // los precios RECIENTES. Antes se tomaba el más barato de TODOS los
    // precios sin importar su antigüedad — el sistema de frescura (_isRecent)
    // ya calculaba y hasta mostraba la etiqueta "Hace 3 meses", pero nada
    // impedía que ese precio congelado ganara el lugar principal si resultaba
    // ser el más bajo. Una tienda que llevara meses sin actualizarse podía así
    // "ganarle" el hero a una tienda con datos frescos de hoy mismo.
    //
    // Con esto: si hay al menos un precio reciente, el hero sale de ahí
    // (valid ya está ordenado por precio, así que el filtro preserva el
    // orden). Solo si TODAS las tiendas están desactualizadas se recurre al
    // precio más barato general — y como ya se muestra con su etiqueta
    // "status-old" real, sigue siendo honesto con el usuario, nunca oculta
    // que el dato es viejo.
    const recentValid = valid.filter(p => p._isRecent);
    const heroItem = recentValid.length > 0
      ? recentValid[0]
      : (valid.length > 0 ? valid[0] : null);

    // =====================================================
    // RENDER HERO
    // =====================================================
    if (heroItem && ui.heroBlock) {
      ui.heroBlock.style.display = "grid";
      ui.heroBlock.offsetHeight; // Forzar reflow para disparar la animación de entrada
      ui.heroBlock.classList.add("visible");
      ui.heroPrice.innerHTML = formatPrice(heroItem.price);

      ui.heroStoreLogo.src = heroItem.logo.replace(/(\.[\w\d]+)$/i, "-mobile.webp");
      ui.heroStoreLogo.width = 100;
      ui.heroStoreLogo.height = 50;
      ui.heroStoreLogo.setAttribute("loading", "eager");

      ui.heroStoreLogo.alt = `Logo de ${heroItem.store}`;

      // AQUI INSERTAMOS EL BADGE EN EL HERO
      ui.heroStoreName.innerHTML = heroItem.store + getHighFreqBadge(heroItem.store);

      ui.heroLink.href = heroItem["link-a"] || heroItem.link;

      const cat = heroItem._isRecent ? "recent" : "outdated";
      const info = getUpdateTimeInfo(heroItem.lastUpdated, cat);
      ui.heroUpdateTime.textContent = info.text;
      ui.heroUpdateTime.className = `update-time ${info.class}`;

      refreshGeoSentenceStamp(heroItem.lastUpdated, cat);
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
    document.dispatchEvent(new Event("ConsolaTemplateLoaded"));
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
      ? "Stock No Detectado"
      : `$${formatPrice(price.price)}`;

  const priceClass =
    category === "outdated" ? "price-val-row old-data" : "price-val-row";

  const logoSrc = price.logo.replace(/(\.[\w\d]+)$/i, "-mobile.webp");

  // Inyectamos el badge si corresponde
  const badgeHTML = getHighFreqBadge(price.store);

  row.innerHTML = `
    <div class="col-store">
      <img src="${logoSrc}" 
           alt="Logo de ${price.store}" 
           class="store-logo-img"
           width="100" height="50"
           loading="lazy">
      <div class="store-meta">
        <span class="store-name-text">${price.store}${badgeHTML}</span>
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
    // Ignorar elementos que estén temporalmente ocultos (ej. el hero block)
    if (window.getComputedStyle(el).display === "none") return;

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
  document.addEventListener("catalog-main-loaded", loadConsoleData, { once: true });
}