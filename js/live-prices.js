// The generated HTML remains useful without JavaScript or a working API.
// Update only prices after a complete, validated catalog response arrives.
(function () {
  "use strict";

  const MAX_AGE = 48 * 60 * 60 * 1000;
  const rejectedFlags = ["valid", "identityValid", "variantValid", "asinValid", "modelValid", "availabilityValid", "success", "accepted"];
  let refreshing = false;
  let lastRefresh = 0;

  function observedTime(value) {
    if (typeof value !== "string" || !value.includes("T")) return NaN;
    return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : value + "-06:00");
  }

  function currentOffers(product) {
    const now = Date.now();
    return product.prices.filter(offer => {
      const accepted = observedTime(offer.acceptedAt);
      const updated = observedTime(offer.lastUpdated);
      const link = offer["link-a"] || offer.link;
      return Number.isFinite(offer.price) && offer.price > 0 &&
        offer.validationStatus === "accepted" && !offer.error &&
        rejectedFlags.every(key => offer[key] !== false) &&
        (offer.status == null || ["success", "ok", "accepted"].includes(offer.status)) &&
        !["outofstock", "unavailable", "agotado"].includes(String(offer.availability || "").toLowerCase().split("/").pop()) &&
        Number.isFinite(accepted) && Number.isFinite(updated) &&
        accepted <= updated && updated <= now && now - accepted >= 0 && now - accepted <= MAX_AGE &&
        typeof offer.store === "string" && offer.store.trim() &&
        typeof offer.logo === "string" && offer.logo &&
        typeof link === "string" && /^https?:\/\//i.test(link);
    }).sort((a, b) => a.price - b.price);
  }

  function priceText(price, decimals = 2) {
    return price.toLocaleString("es-MX", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function setPrice(element, price) {
    const parts = priceText(price).split(".");
    const decimals = document.createElement("span");
    decimals.className = "price-decimals";
    decimals.textContent = parts.pop();
    element.replaceChildren(document.createTextNode(parts.join(".")), decimals);
  }

  function setStoreName(element, store) {
    element.textContent = store;
    if (["Amazon", "MercadoLibre", "Walmart"].includes(store)) {
      const badge = document.createElement("span");
      badge.className = "freq-badge";
      badge.dataset.tooltip = "⚡️ El precio de esta tienda cambia varias veces al día.";
      badge.textContent = " ⚡";
      element.append(badge);
    }
  }

  function rowFor(offer) {
    const row = document.createElement("div");
    row.className = "price-row recent";
    const store = document.createElement("div");
    store.className = "col-store";
    const logo = document.createElement("img");
    logo.src = offer.logo;
    logo.alt = "Logo de " + offer.store;
    logo.className = "store-logo-img";
    logo.width = 100;
    logo.height = 50;
    logo.loading = "lazy";
    const name = document.createElement("span");
    name.className = "store-name-text";
    setStoreName(name, offer.store);
    const meta = document.createElement("div");
    meta.className = "store-meta";
    meta.append(name);
    store.append(logo, meta);
    const price = document.createElement("div");
    price.className = "col-price";
    const value = document.createElement("span");
    value.className = "price-val-row";
    const number = document.createElement("span");
    setPrice(number, offer.price);
    value.append(document.createTextNode("$"), number);
    price.append(value);
    const action = document.createElement("div");
    action.className = "col-action";
    const link = document.createElement("a");
    link.href = offer["link-a"] || offer.link;
    link.target = "_blank";
    link.rel = "nofollow noopener";
    link.className = "btn-go-store";
    link.textContent = "Ver >";
    link.setAttribute("aria-label", "Ver oferta en " + offer.store);
    action.append(link);
    row.append(store, price, action);
    return row;
  }

  function renderProduct(product) {
    const hero = document.getElementById("hero-price-container");
    const list = document.getElementById("price-cards");
    if (!hero || !list) return;
    const offers = currentOffers(product);
    const best = offers[0];
    const rows = document.createDocumentFragment();
    offers.slice(1).forEach(offer => rows.append(rowFor(offer)));
    let sentence = document.getElementById("pdp-geo-price-sentence");
    let empty = document.querySelector(".pdp-no-current-offers");

    if (best) {
      setPrice(document.getElementById("hero-best-price-val"), best.price);
      setStoreName(document.getElementById("hero-store-name"), best.store);
      const logo = document.getElementById("hero-store-logo");
      logo.src = best.logo;
      logo.alt = "Logo de " + best.store;
      document.getElementById("hero-btn-link").href = best["link-a"] || best.link;
      hero.style.display = "grid";
      hero.classList.add("visible");
      if (empty) empty.hidden = true;
      if (!sentence) {
        sentence = document.createElement("p");
        sentence.id = "pdp-geo-price-sentence";
        sentence.className = "pdp-geo-price-sentence";
        (hero.closest("#sticky-hero-wrapper") || hero).insertAdjacentElement("afterend", sentence);
      }
      sentence.hidden = false;
      sentence.dataset.updated = best.acceptedAt;
      const stamp = document.createElement("time");
      stamp.dateTime = best.acceptedAt;
      stamp.textContent = new Date(observedTime(best.acceptedAt)).toLocaleString("es-MX", {
        dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City"
      });
      sentence.replaceChildren(document.createTextNode("El precio más bajo detectado para la " + product.name + " es $" +
        priceText(best.price) + " MXN en " + best.store + ", según la última lectura del "), stamp, document.createTextNode("."));
    } else {
      hero.style.display = "none";
      if (sentence) sentence.hidden = true;
      if (!empty) {
        empty = document.createElement("p");
        empty.className = "pdp-no-current-offers";
        hero.insertAdjacentElement("afterend", empty);
      }
      empty.textContent = "No hay ofertas vigentes verificadas.";
      empty.hidden = false;
      const wrapper = document.getElementById("sticky-hero-wrapper");
      if (wrapper) wrapper.style.height = "0px";
    }
    list.replaceChildren(rows);
    document.dispatchEvent(new Event("ConsolaTemplateLoaded"));
  }

  function renderCard(card, product) {
    const container = card.querySelector(".price-container");
    if (!container) return;
    const best = currentOffers(product)[0];
    const label = document.createElement("span");
    label.className = "price-label";
    label.textContent = best ? "Mejor Precio" : "Sin ofertas vigentes";
    const value = document.createElement("span");
    value.className = "price-value";
    value.textContent = best ? "$" + priceText(best.price, 0) : "";
    container.replaceChildren(label, value);
    const badge = card.querySelector(".deal-badge");
    if (badge) badge.hidden = !best;
  }

  async function refresh() {
    if (document.visibilityState === "hidden" || !window.KamziluCatalogs || refreshing || Date.now() - lastRefresh < 30000) return;
    const registry = window.KamziluCatalogs;
    const cards = Array.from(document.querySelectorAll(".product-card[data-slug]"));
    const category = registry.fromPath();
    const isProduct = !!document.getElementById("product-name");
    if (!cards.length && !isProduct) return;
    const categories = category ? [category] : registry.all;
    refreshing = true;
    lastRefresh = Date.now();
    await Promise.all(categories.map(async catalog => {
      try {
        const response = await fetch(registry.sourceUrl(catalog), { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error("Catalog HTTP " + response.status);
        const data = await response.json();
        const slug = location.pathname.split("/").filter(Boolean).filter(part => !part.endsWith(".html")).pop();
        if (isProduct) {
          if (!data[slug] || !Array.isArray(data[slug].prices)) throw new Error("Invalid product catalog");
          renderProduct(data[slug]);
        }
        cards.forEach(card => {
          const product = data[card.dataset.slug];
          if (product && Array.isArray(product.prices)) renderCard(card, product);
        });
        document.documentElement.dataset.livePrices = "updated";
      } catch (error) {
        // Keep the complete timestamped HTML when the API cannot be reached.
        if (document.documentElement.dataset.livePrices !== "updated") {
          document.documentElement.dataset.livePrices = "fallback";
        }
      }
    }));
    refreshing = false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (!document.documentElement.hasAttribute("data-static-prices")) return;
    refresh();
    window.setInterval(refresh, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", refresh);
  });
})();
