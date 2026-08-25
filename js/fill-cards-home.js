document.addEventListener("DOMContentLoaded", async () => {
  const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 horas

  function initMobileCardReveal() {
    if (window.innerWidth > 768) return;

    const grid = document.querySelector(".product-grid");
    if (grid) {
      grid.classList.remove("fadein");
      grid.classList.add("visible");
    }

    const cards = document.querySelectorAll(".product-card");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.03,
      rootMargin: "0px 0px 80px 0px",
    });

    cards.forEach((card) => {
      card.classList.add("scrollup", "home-card-reveal");
      observer.observe(card);
    });
  }

  try {
    // La API en vivo (api.kamzilu.com) solo permite CORS desde el dominio
    // real de producción. Antes esto se detectaba al revés (solo
    // localhost/127.0.0.1/file: se consideraban "local"), así que cualquier
    // vista previa desde otra máquina en la red (IP del Pi, otro hostname,
    // etc.) intentaba pegarle a la API en vivo y el navegador la bloqueaba
    // por CORS. Ahora se asume JSON local salvo que estemos en el dominio
    // real de producción.
    const isProduction =
      location.hostname === "kamzilu.com" ||
      location.hostname === "www.kamzilu.com";

    const API_URL = isProduction
      ? "https://api.kamzilu.com/api/consolas"
      : "/data/consolas.json";

    const response = await fetch(API_URL);
    const data = await response.json();

    // Configuración de optimización de imágenes para Lighthouse
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

    document.querySelectorAll(".product-card").forEach(card => {
      // Cada tarjeta se procesa de forma aislada: si una viene con datos
      // mal formados, no debe tumbar el llenado de las demás tarjetas.
      try {
        const slug = card.dataset.slug;
        const item = data[slug];

        if (!item || !Array.isArray(item.prices)) {
          card.style.display = "none";
          return;
        }

        const now = new Date();

        const recentPrices = item.prices.filter(p => {
          if (!(typeof p.price === "number" && !isNaN(p.price))) return false;
          if (!p.lastUpdated) return false;
          const lastUpdate = new Date(p.lastUpdated);
          return (now - lastUpdate) <= RECENT_THRESHOLD_MS;
        });

        if (!recentPrices.length) {
          card.style.display = "none";
          return;
        }

        const minPrice = Math.min(...recentPrices.map(p => p.price)).toLocaleString("es-MX", {
          style: "currency",
          currency: "MXN",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });

        const brand = item.brand?.toLowerCase() || "otros";
        const image = item.image;
        const name = item.name;
        const href = `/consolas/${brand}/${slug}/index.html`;

        let imgAttrs = `src="${image}" alt="${name}" loading="lazy"`;

        if (imgConfig[slug]) {
          const { w, h, renderMobile, mobileSrc } = imgConfig[slug];
          // Plantilla estricta requerida por el usuario
          // srcset: [RUTA_MOVIL] 400w, [RUTA_ORIGINAL] [ANCHO_ORIGINAL]w
          // sizes: (max-width: 600px) [RENDER_MOVIL_APROX]px, [ANCHO_ORIGINAL]px
          imgAttrs = `src="${image}"
                      srcset="${mobileSrc} 400w, ${image} ${w}w"
                      sizes="(max-width: 600px) ${renderMobile}px, ${w}px"
                      width="${w}" height="${h}"
                      alt="${name}" loading="lazy"`;
        }

        card.innerHTML = `
          <a href="${href}">
            <div class="deal-badge">Oferta</div>
            <div class="card-image-wrapper">
              <img ${imgAttrs}>
            </div>
            <h3>${name}</h3>
            <div class="price-container">
              <span class="price-label">Mejor Precio</span>
              <span class="price-value">${minPrice}</span>
            </div>
          </a>
        `;
      } catch (cardError) {
        // No dejamos la tarjeta atascada en su "skeleton": si algo falla
        // para este producto puntual, simplemente la ocultamos y seguimos
        // con el resto del grid.
        console.error(`Error al renderizar la tarjeta "${card.dataset.slug}":`, cardError);
        card.style.display = "none";
      }
    });

    initMobileCardReveal();

  } catch (error) {
    console.error("Error cargando consolas:", error);
  }
});
