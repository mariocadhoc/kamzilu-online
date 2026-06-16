document.addEventListener("DOMContentLoaded", () => {
  function isMobileViewport() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function isMobileLandscape() {
    return isMobileViewport() && window.matchMedia("(orientation: landscape)").matches;
  }

  function startOfWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = (d.getDay() + 6) % 7; // Monday-based week
    d.setDate(d.getDate() - day);
    return d;
  }

  function aggregateWeekly(points) {
    const buckets = new Map();

    points.forEach((point) => {
      const weekStart = startOfWeek(point.date);
      const key = weekStart.toISOString().slice(0, 10);
      const current = buckets.get(key);

      if (!current || point.price < current.price) {
        buckets.set(key, {
          ...point,
          date: weekStart,
          timestamp: weekStart.getTime(),
        });
      }
    });

    return Array.from(buckets.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  function normalizeSeries(points) {
    return points.map(pt => ({
      date: new Date(pt.date),
      timestamp: new Date(pt.date).getTime(),
      price: parseFloat(pt.price),
      store: pt.store || null
    })).sort((a, b) => a.timestamp - b.timestamp);
  }
  
  function initChart() {
    // Solo ejecutar si el contenedor de la gráfica está en el DOM
    const container = document.getElementById("price-history-chart");
    const section = document.getElementById("price-history-section");
    if (!container || !section) return;

    const RECENT_THRESHOLD_MS = 24 * 60 * 60 * 1000;

    // 1. Obtener slug del producto desde la URL
    function getSlug() {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts[parts.length - 1].includes(".html")) parts.pop();
      return parts[parts.length - 1];
    }

    const productId = getSlug();

    // 2. Cargar datos del JSON consolidado
    fetch("/data/price-history.json")
      .then(res => {
        if (!res.ok) throw new Error("No se pudo cargar el histórico.");
        return res.json();
      })
      .then(data => {
        const series = data.series[productId];
        // Si no hay datos o hay menos de 5 puntos, no mostrar gráfico
        if (!series || series.length < 5) {
          section.style.display = "none";
          return;
        }

        // Mostrar sección
        section.style.display = "block";

        const renderResponsiveChart = () => renderSVGChart(container, series);
        renderResponsiveChart();

        if (!container.dataset.responsiveChartBound) {
          let resizeTimer = null;
          const handleResize = () => {
            window.clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(renderResponsiveChart, 120);
          };

          window.addEventListener("resize", handleResize);
          window.addEventListener("orientationchange", handleResize);
          container.dataset.responsiveChartBound = "true";
        }
      })
      .catch(err => {
        console.error("[Chart] Error cargando histórico:", err);
        section.style.display = "none";
      });
  }

  // 3. Renderizador del SVG interactivo
  function renderSVGChart(wrapper, points) {
    // Limpiar contenedor previo
    wrapper.innerHTML = "";

    const mobile = isMobileViewport();
    const mobileLandscape = isMobileLandscape();

    // Dimensiones lógicas (viewBox)
    const width = mobile ? 800 : 800;
    const height = mobile ? (mobileLandscape ? 340 : 430) : 300;
    const padding = mobile
      ? { top: 52, right: 18, bottom: 62, left: 68 }
      : { top: 56, right: 30, bottom: 40, left: 60 };

    // Mapear puntos a tipos correctos y ordenar
    const normalizedData = normalizeSeries(points);
    const data = mobile && !mobileLandscape ? aggregateWeekly(normalizedData) : normalizedData;

    // Valores extremos
    const prices = data.map(d => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Agregar un margen del 8% al tope y fondo del eje Y
    const yMargin = (maxPrice - minPrice) * 0.08 || 500;
    const yMin = Math.max(0, minPrice - yMargin);
    const yMax = maxPrice + yMargin;

    const timestamps = data.map(d => d.timestamp);
    const xMin = Math.min(...timestamps);
    const xMax = Math.max(...timestamps);

    // Funciones de mapeo a coordenadas SVG
    const getX = (ts) => padding.left + ((ts - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
    const getY = (price) => height - padding.bottom - ((price - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

    // Crear elemento SVG
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.overflow = "visible";

    // Inyectar defs (degradados)
    svg.innerHTML = `
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2563EB" stop-opacity="0.15"/>
          <stop offset="100%" stop-color="#2563EB" stop-opacity="0.00"/>
        </linearGradient>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#2563EB"/>
          <stop offset="100%" stop-color="#00f2fe"/>
        </linearGradient>
      </defs>
    `;

    // ── DIBUJAR EJES Y CUADRÍCULA ──
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const priceVal = yMin + (i / gridCount) * (yMax - yMin);
      const y = getY(priceVal);

      // Línea horizontal de cuadrícula
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", padding.left);
      line.setAttribute("y1", y);
      line.setAttribute("x2", width - padding.right);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(15, 23, 42, 0.08)");
      line.setAttribute("stroke-dasharray", "4,4");
      svg.appendChild(line);

      // Etiqueta del eje Y (Precio)
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", padding.left - 10);
      text.setAttribute("y", y + 4);
      text.setAttribute("text-anchor", "end");
      text.setAttribute("fill", "#64748b");
      text.style.fontFamily = "var(--font-barlow, sans-serif)";
      text.style.fontSize = mobile ? "13px" : "11px";
      text.textContent = `$${Math.round(priceVal).toLocaleString("es-MX")}`;
      svg.appendChild(text);
    }

    // Dibujar etiquetas de tiempo (X) - 3 puntos equidistantes
    const xLabelCount = mobile ? 4 : 3;
    for (let i = 0; i < xLabelCount; i++) {
      const ts = xMin + (i / (xLabelCount - 1)) * (xMax - xMin);
      const x = getX(ts);
      const date = new Date(ts);
      
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", height - padding.bottom + 22);
      text.setAttribute("text-anchor", i === 0 ? "start" : i === xLabelCount - 1 ? "end" : "middle");
      text.setAttribute("fill", "#64748b");
      text.style.fontFamily = "var(--font-barlow, sans-serif)";
      text.style.fontSize = mobile ? "13px" : "11px";

      // Formato corto mes/año
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      text.textContent = mobile && !mobileLandscape
        ? `${date.getDate()} ${months[date.getMonth()]}`
        : `${months[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
      svg.appendChild(text);
    }

    // ── DIBUJAR LÍNEA Y ÁREA (con detección de gaps) ──
    // En mobile portrait la serie se agrega por semanas, así que el umbral de
    // gap debe ser mayor para no convertir toda la línea en conectores punteados.
    // En esos tramos se muestra un conector gris discontinuo y no se rellena el área.
    const GAP_DAYS = mobile && !mobileLandscape ? 10 : 3;
    const MS_PER_DAY = 86400000;

    let solidPath = "";       // segmentos con datos reales (color)
    let gapPath   = "";       // conectores de gaps (gris, discontinuo)
    let areaData  = "";       // relleno bajo la línea sólida (por segmentos)

    data.forEach((d, idx) => {
      const x = getX(d.timestamp);
      const y = getY(d.price);
      const baseline = height - padding.bottom;

      if (idx === 0) {
        solidPath += `M ${x} ${y} `;
        areaData  += `M ${x} ${baseline} L ${x} ${y} `;
      } else {
        const dayGap = (d.timestamp - data[idx - 1].timestamp) / MS_PER_DAY;
        if (dayGap > GAP_DAYS) {
          // Cerrar segmento de área anterior
          const prevX = getX(data[idx - 1].timestamp);
          areaData  += `L ${prevX} ${baseline} Z `;
          // Conector gris (gap): de prevX→y_prev hasta x→y
          const prevY = getY(data[idx - 1].price);
          gapPath   += `M ${prevX} ${prevY} L ${x} ${y} `;
          // Iniciar nuevo segmento sólido
          solidPath += `M ${x} ${y} `;
          areaData  += `M ${x} ${baseline} L ${x} ${y} `;
        } else {
          solidPath += `L ${x} ${y} `;
          areaData  += `L ${x} ${y} `;
        }
      }
    });
    // Cerrar último segmento de área
    const lastX = getX(data[data.length - 1].timestamp);
    areaData += `L ${lastX} ${height - padding.bottom} Z`;

    // 1. Relleno degradado (sólo tramos con datos)
    const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    areaPath.setAttribute("d", areaData);
    areaPath.setAttribute("fill", "url(#areaGrad)");
    svg.appendChild(areaPath);

    // 2. Conectores de gap (gris discontinuo, antes de la línea principal)
    if (gapPath) {
      const gapPathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
      gapPathEl.setAttribute("d", gapPath);
      gapPathEl.setAttribute("fill", "none");
      gapPathEl.setAttribute("stroke", "#cbd5e1");
      gapPathEl.setAttribute("stroke-width", "1.5");
      gapPathEl.setAttribute("stroke-dasharray", "5,5");
      gapPathEl.setAttribute("stroke-linecap", "round");
      gapPathEl.style.opacity = "0.6";
      svg.appendChild(gapPathEl);
    }

    // 3. Línea principal (tramos con datos reales)
    const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    linePath.setAttribute("d", solidPath);
    linePath.setAttribute("fill", "none");
    linePath.setAttribute("stroke", "url(#lineGrad)");
    linePath.setAttribute("stroke-width", "2.5");
    linePath.setAttribute("stroke-linecap", "round");
    linePath.setAttribute("stroke-linejoin", "round");
    svg.appendChild(linePath);

    // ── INTERACTIVIDAD (TRACKER & TOOLTIP) ──
    // 1. Línea guía vertical B (Punto activo / Punto B) - Azul/Cyan
    const trackerLineB = document.createElementNS("http://www.w3.org/2000/svg", "line");
    trackerLineB.setAttribute("y1", padding.top);
    trackerLineB.setAttribute("y2", height - padding.bottom);
    trackerLineB.setAttribute("stroke", "rgba(37, 99, 235, 0.45)");
    trackerLineB.setAttribute("stroke-width", "1");
    trackerLineB.setAttribute("stroke-dasharray", "4,4");
    trackerLineB.style.display = "none";
    svg.appendChild(trackerLineB);

    // 2. Punto Tracker B (Punto activo / Punto B) - Azul
    const trackerDotB = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    trackerDotB.setAttribute("r", "6");
    trackerDotB.setAttribute("fill", "#2563EB");
    trackerDotB.setAttribute("stroke", "#ffffff");
    trackerDotB.setAttribute("stroke-width", "2");
    trackerDotB.style.display = "none";
    trackerDotB.style.pointerEvents = "none";
    svg.appendChild(trackerDotB);

    // 3. Línea guía vertical A (Fijación A) - Naranja
    const trackerLineA = document.createElementNS("http://www.w3.org/2000/svg", "line");
    trackerLineA.setAttribute("y1", padding.top);
    trackerLineA.setAttribute("y2", height - padding.bottom);
    trackerLineA.setAttribute("stroke", "rgba(249, 115, 22, 0.45)");
    trackerLineA.setAttribute("stroke-width", "1.5");
    trackerLineA.setAttribute("stroke-dasharray", "4,4");
    trackerLineA.style.display = "none";
    svg.appendChild(trackerLineA);

    // 4. Punto Tracker A (Fijación A) - Naranja
    const trackerDotA = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    trackerDotA.setAttribute("r", "6");
    trackerDotA.setAttribute("fill", "#f97316");
    trackerDotA.setAttribute("stroke", "#ffffff");
    trackerDotA.setAttribute("stroke-width", "2");
    trackerDotA.style.display = "none";
    trackerDotA.style.pointerEvents = "none";
    svg.appendChild(trackerDotA);

    // 5. Crear Tooltip flotante local en el wrapper
    let tooltip = wrapper.querySelector(".pdp-history-tooltip");
    if (!tooltip) {
      tooltip = document.createElement("div");
      tooltip.className = "pdp-history-tooltip";
      tooltip.style.position = "absolute";
      tooltip.style.display = "none";
      tooltip.style.pointerEvents = "none";
      tooltip.style.zIndex = "1000";
      wrapper.appendChild(tooltip);
    }

    // 6. Crear Panel de comparación A-B flotante local en el wrapper
    let comparePanel = wrapper.querySelector(".pdp-history-compare-panel");
    if (!comparePanel) {
      comparePanel = document.createElement("div");
      comparePanel.className = "pdp-history-compare-panel";
      comparePanel.style.position = "absolute";
      comparePanel.style.display = "none";
      comparePanel.style.pointerEvents = "none";
      comparePanel.style.zIndex = "1000";
      wrapper.appendChild(comparePanel);
    }

    // 7. Rectángulo transparente para capturar eventos de ratón
    const overlay = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    overlay.setAttribute("x", 0);
    overlay.setAttribute("y", 0);
    overlay.setAttribute("width", width);
    overlay.setAttribute("height", height);
    overlay.setAttribute("fill", "transparent");
    overlay.style.cursor = "crosshair";
    svg.appendChild(overlay);

    // Adjuntar SVG al wrapper de la página
    wrapper.appendChild(svg);

    // Calcular longitud exacta del trazo para la animación
    const totalLength = linePath.getTotalLength();

    // Helper para convertir coordenadas de pantalla a SVG
    function getSVGCoords(clientX, clientY) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
      return { x: svgP.x, y: svgP.y };
    }

    // Helper para buscar el punto más cercano horizontalmente
    function getClosestPoint(mouseX) {
      const progress = (mouseX - padding.left) / (width - padding.left - padding.right);
      const targetTs = xMin + progress * (xMax - xMin);

      let closest = data[0];
      let minDiff = Math.abs(closest.timestamp - targetTs);

      for (let i = 1; i < data.length; i++) {
        const diff = Math.abs(data[i].timestamp - targetTs);
        if (diff < minDiff) {
          minDiff = diff;
          closest = data[i];
        }
      }
      return closest;
    }

    // Variables de Estado de Medición A-B
    let isMeasuring = false;
    let pointA = null;
    let pointB = null;

    function showTooltip(e, clientX, clientY) {
      if (isMeasuring) return; // Omitir tooltip normal durante la medición

      const coords = getSVGCoords(clientX, clientY);
      let localX = coords.x;

      const plotLeft = padding.left;
      const plotRight = width - padding.right;
      if (localX < plotLeft) localX = plotLeft;
      if (localX > plotRight) localX = plotRight;

      const point = getClosestPoint(localX);
      const px = getX(point.timestamp);
      const py = getY(point.price);

      // Mostrar y actualizar elementos interactivos del SVG
      trackerLineB.setAttribute("x1", px);
      trackerLineB.setAttribute("x2", px);
      trackerLineB.style.display = "block";

      trackerDotB.setAttribute("cx", px);
      trackerDotB.setAttribute("cy", py);
      trackerDotB.style.display = "block";

      // Formatear textos
      const options = { day: 'numeric', month: 'long', year: 'numeric' };
      const formattedDate = point.date.toLocaleDateString('es-MX', options);
      const formattedPrice = point.price.toLocaleString('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      });

      let storeLine = "";
      if (point.store) {
        storeLine = `<div class="tooltip-store">${point.store}</div>`;
      }

      tooltip.innerHTML = `
        <div class="tooltip-date">${formattedDate.toUpperCase()}</div>
        <div class="tooltip-price">${formattedPrice} MXN</div>
        ${storeLine}
      `;

      // Posicionar tooltip flotante en coordenadas relativas al wrapper
      tooltip.style.display = "block";
      const tooltipRect = tooltip.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const dotRect = trackerDotB.getBoundingClientRect();

      let left = (dotRect.left - wrapperRect.left) + dotRect.width / 2 - tooltipRect.width / 2;
      let top = (dotRect.top - wrapperRect.top) - tooltipRect.height - 8;

      // Clamps de bordes del wrapper
      const minLeft = 10;
      const maxLeft = wrapperRect.width - tooltipRect.width - 10;
      if (left < minLeft) left = minLeft;
      if (left > maxLeft) left = maxLeft;

      if (top < 5) {
        top = (dotRect.bottom - wrapperRect.top) + 8;
      }

      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    }

    function hideTooltip() {
      if (isMeasuring) return;
      trackerLineB.style.display = "none";
      trackerDotB.style.display = "none";
      tooltip.style.display = "none";
    }

    // LÓGICA DE MEDICIÓN INTERACTIVA (A-B)
    function startMeasuring(clientX, clientY) {
      isMeasuring = true;
      tooltip.style.display = "none"; // Ocultar tooltip normal

      const coords = getSVGCoords(clientX, clientY);
      let localX = coords.x;
      const plotLeft = padding.left;
      const plotRight = width - padding.right;
      if (localX < plotLeft) localX = plotLeft;
      if (localX > plotRight) localX = plotRight;

      pointA = getClosestPoint(localX);
      
      // Dibujar punto A
      const pxA = getX(pointA.timestamp);
      const pyA = getY(pointA.price);
      trackerLineA.setAttribute("x1", pxA);
      trackerLineA.setAttribute("x2", pxA);
      trackerLineA.style.display = "block";
      trackerDotA.setAttribute("cx", pxA);
      trackerDotA.setAttribute("cy", pyA);
      trackerDotA.style.display = "block";

      // Forzar actualización inicial de B en la misma posición
      updateMeasuring(clientX, clientY);
    }

    function updateMeasuring(clientX, clientY) {
      if (!isMeasuring || !pointA) return;

      const coords = getSVGCoords(clientX, clientY);
      let localX = coords.x;
      const plotLeft = padding.left;
      const plotRight = width - padding.right;
      if (localX < plotLeft) localX = plotLeft;
      if (localX > plotRight) localX = plotRight;

      pointB = getClosestPoint(localX);

      // Dibujar punto B
      const pxB = getX(pointB.timestamp);
      const pyB = getY(pointB.price);
      trackerLineB.setAttribute("x1", pxB);
      trackerLineB.setAttribute("x2", pxB);
      trackerLineB.style.display = "block";
      trackerDotB.setAttribute("cx", pxB);
      trackerDotB.setAttribute("cy", pyB);
      trackerDotB.style.display = "block";

      // Calcular diferencias
      const diffVal = pointB.price - pointA.price;
      const diffPercent = ((pointB.price - pointA.price) / pointA.price) * 100;

      // Formatear panel de comparación compacto
      const options = { day: 'numeric', month: 'short', year: 'numeric' };
      const dateA = pointA.date.toLocaleDateString('es-MX', options);
      const dateB = pointB.date.toLocaleDateString('es-MX', options);
      const priceA = pointA.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const priceB = pointB.price.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });

      const storeA = pointA.store ? ` · ${pointA.store}` : "";
      const storeB = pointB.store ? ` · ${pointB.store}` : "";

      let diffClass = "neutral";
      let sign = "";
      if (diffVal > 0) {
        diffClass = "positive";
        sign = "+";
      } else if (diffVal < 0) {
        diffClass = "negative";
      }

      // Mostrar siempre el signo correcto: positivo = "+$X", negativo = "-$X" (desde toLocaleString)
      const formattedAmount = diffVal.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const formattedDelta = `${sign}${formattedAmount} MXN (${sign}${diffPercent.toFixed(2)}%)`;

      comparePanel.innerHTML = `
        <div class="cp-delta ${diffClass}">${formattedDelta}</div>
        <div class="cp-points">
          <span class="cp-marker cp-a">A</span>
          <span class="cp-info">${dateA} · ${priceA}${storeA}</span>
          <span class="cp-sep">→</span>
          <span class="cp-marker cp-b">B</span>
          <span class="cp-info">${dateB} · ${priceB}${storeB}</span>
        </div>
      `;

      // Posicionar panel arriba-izquierda, fijo, sin seguir el mouse
      comparePanel.style.display = "block";
      comparePanel.style.left = `${padding.left}px`;

      // Calcular top dinámico: borde inferior del panel queda ≥8px por encima del plot
      const panelH = comparePanel.offsetHeight;
      const svgPt = svg.createSVGPoint();
      svgPt.x = padding.left;
      svgPt.y = padding.top;
      const screenPt = svgPt.matrixTransform(svg.getScreenCTM());
      const wrapperTop = wrapper.getBoundingClientRect().top;
      const plotTopPx = screenPt.y - wrapperTop;          // coord CSS relativa al wrapper
      const panelTop = Math.max(4, plotTopPx - panelH - 8);
      comparePanel.style.top = `${panelTop}px`;
    }

    function stopMeasuring() {
      if (!isMeasuring) return;
      isMeasuring = false;
      pointA = null;
      pointB = null;

      trackerLineA.style.display = "none";
      trackerDotA.style.display = "none";
      trackerLineB.style.display = "none";
      trackerDotB.style.display = "none";
      comparePanel.style.display = "none";
    }

    // Eventos Mouse
    overlay.addEventListener("mousedown", (e) => {
      e.preventDefault();
      startMeasuring(e.clientX, e.clientY);
    });

    overlay.addEventListener("mousemove", (e) => {
      if (isMeasuring) {
        updateMeasuring(e.clientX, e.clientY);
      } else {
        showTooltip(e, e.clientX, e.clientY);
      }
    });

    window.addEventListener("mouseup", () => {
      if (isMeasuring) stopMeasuring();
    });

    overlay.addEventListener("mouseleave", () => {
      if (!isMeasuring) hideTooltip();
    });

    // Eventos Touch (Móvil)
    // 1 dedo → tooltip normal  |  2 dedos simultáneos → medición A-B
    overlay.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        // Dos dedos: iniciar A-B. Dedo 0 = Punto A, Dedo 1 = Punto B inicial
        const t0 = e.touches[0];
        startMeasuring(t0.clientX, t0.clientY);
        const t1 = e.touches[1];
        updateMeasuring(t1.clientX, t1.clientY);
      } else if (e.touches.length === 1) {
        // Un dedo: tooltip normal. Si venía de A-B, salir primero
        if (isMeasuring) stopMeasuring();
        const touch = e.touches[0];
        showTooltip(e, touch.clientX, touch.clientY);
      }
    }, { passive: true });

    overlay.addEventListener("touchmove", (e) => {
      if (e.cancelable) e.preventDefault();
      if (e.touches.length === 2 && isMeasuring) {
        // Mover cualquier dedo durante A-B: actualizar Punto B con el segundo dedo
        const t1 = e.touches[1];
        updateMeasuring(t1.clientX, t1.clientY);
      } else if (e.touches.length === 1) {
        if (isMeasuring) stopMeasuring();
        const touch = e.touches[0];
        showTooltip(e, touch.clientX, touch.clientY);
      }
    }, { passive: false });

    overlay.addEventListener("touchend", (e) => {
      if (e.touches.length === 0) {
        // Todos los dedos levantados: cerrar lo que esté activo
        if (isMeasuring) stopMeasuring();
        else hideTooltip();
      } else if (e.touches.length === 1 && isMeasuring) {
        // Un dedo levantado durante A-B: salir del modo A-B y mostrar tooltip simple
        stopMeasuring();
        const touch = e.touches[0];
        showTooltip(e, touch.clientX, touch.clientY);
      }
    });

    // ── ANIMACIONES CON INTERSECTIONOBSERVER ──
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Configuración de estado inicial para la animación
    if (reducedMotion) {
      linePath.style.strokeDasharray = totalLength;
      linePath.style.strokeDashoffset = "0";
    } else {
      linePath.style.strokeDasharray = totalLength;
      linePath.style.strokeDashoffset = totalLength;
      linePath.style.transition = "stroke-dashoffset 4s cubic-bezier(0.4, 0, 0.2, 1)";
      
      areaPath.style.opacity = "0";
      areaPath.style.transition = "opacity 3s ease-out 1.6s";

      // Líneas de cuadrícula y etiquetas
      const gridLines = svg.querySelectorAll("line");
      gridLines.forEach(line => {
        if (line !== trackerLineA && line !== trackerLineB) {
          line.style.opacity = "0";
          line.style.transition = "opacity 1s ease-out";
        }
      });
      const textLabels = svg.querySelectorAll("text");
      textLabels.forEach(text => {
        text.style.opacity = "0";
        text.style.transition = "opacity 1s ease-out";
      });
    }

    function startAnimation() {
      if (!reducedMotion) {
        linePath.style.strokeDashoffset = "0";
        areaPath.style.opacity = "1";
        
        const gridLines = svg.querySelectorAll("line");
        gridLines.forEach(line => {
          if (line !== trackerLineA && line !== trackerLineB) {
            line.style.opacity = "1";
          }
        });
        const textLabels = svg.querySelectorAll("text");
        textLabels.forEach(text => {
          text.style.opacity = "1";
        });
      }
    }

    if (window.IntersectionObserver) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            startAnimation();
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.25
      });
      observer.observe(wrapper);
    } else {
      startAnimation();
    }
  }

  // Inicializar cargando el componente
  if (document.getElementById("price-history-chart")) {
    initChart();
  } else {
    document.addEventListener("consolas-main-loaded", initChart);
  }
});
