/**
 * price-insights.js — Sección de insights históricos de eventos comerciales.
 * Carga /data/price-insights.json y renderiza cards de acordeón para la
 * consola actual (detectada por slug en la URL).
 */

(function () {
  'use strict';

  // ── SVG inline (íconos ligeros) ──────────────────────────────────────────
  const ICONS = {
    'hot-sale': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
    'prime-day': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    'buen-fin': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>`,
    'black-friday': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`,
    'cyber-monday': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
    'default': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    'arrow-down': `<svg class="insight-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>`,
    'arrow-up': `<svg class="insight-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`,
    'minus': `<svg class="insight-badge-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    'chevron-down': `<svg class="insight-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`,
  };

  function getIcon(eventId) {
    if (eventId.startsWith('hot-sale'))     return ICONS['hot-sale'];
    if (eventId.startsWith('prime-day'))    return ICONS['prime-day'];
    if (eventId.startsWith('buen-fin'))     return ICONS['buen-fin'];
    if (eventId.startsWith('black-friday')) return ICONS['black-friday'];
    if (eventId.startsWith('cyber-monday')) return ICONS['cyber-monday'];
    return ICONS['default'];
  }

  // ── Detección de slug (mismo patrón que template-item-1-loader.js) ──────
  function detectSlug() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length && parts[parts.length - 1].includes('.html')) parts.pop();
    return parts[parts.length - 1] || null;
  }

  // ── Formato de precios ───────────────────────────────────────────────────
  function fmtPrice(price) {
    if (price == null) return '—';
    return '$' + Math.round(price).toLocaleString('es-MX') + ' MXN';
  }

  function fmtPct(val) {
    if (val == null) return null;
    const abs = Math.abs(val).toFixed(1);
    return val < 0 ? '-' + abs + '%' : '+' + abs + '%';
  }

  // ── Badge por status ─────────────────────────────────────────────────────
  function buildBadge(insight) {
    const status = insight.status;
    const pct    = insight.changeVsPreEventAvgPercent;

    if (status === 'strong_drop' || status === 'relevant_drop') {
      return `<span class="insight-badge badge-drop">${ICONS['arrow-down']}Bajó ${Math.abs(pct).toFixed(1)}%</span>`;
    }
    if (status === 'price_increase') {
      return `<span class="insight-badge badge-rise">${ICONS['arrow-up']}Subió ${Math.abs(pct).toFixed(1)}%</span>`;
    }
    if (status === 'no_relevant_change') {
      return `<span class="insight-badge badge-flat">${ICONS['minus']}Sin cambio relevante</span>`;
    }
    return `<span class="insight-badge badge-nodata">${ICONS['minus']}Sin datos</span>`;
  }

  // ── Métricas numéricas ───────────────────────────────────────────────────
  function buildMetrics(insight, stats) {
    const status = insight.status;
    if (status === 'no_event_data' || status === 'insufficient_baseline') return '';

    const rows = [];

    if (insight.eventMinPrice != null) {
      const priceColor = (status === 'strong_drop' || status === 'relevant_drop')
        ? 'var(--success)'
        : status === 'price_increase'
          ? '#ef4444'
          : null;
      rows.push({
        label: `Precio más bajo en ${insight.eventName}`,
        value: fmtPrice(insight.eventMinPrice),
        color: priceColor,
        date: fmtDateShort(insight.eventMinDate),
        store: insight.eventMinStore ? `<strong>${insight.eventMinStore}</strong>` : null
      });
    }

    if (insight.preEventAvgPrice != null) {
      rows.push({
        label: 'Precio promedio 1 semana antes del evento',
        value: fmtPrice(insight.preEventAvgPrice)
      });
    }

    if (!rows.length) return '';

    return `<div class="insight-metrics">
      ${rows.map(r => `<div class="insight-metric">
        <div class="insight-metric-label">${r.label}</div>
        <div class="insight-metric-value"${r.color ? ` style="color:${r.color}"` : ''}>${r.value}</div>
        ${r.date ? `<div class="insight-source-note" style="margin-top:4px">${r.date}</div>` : ''}
        ${r.store ? `<div class="insight-source-note" style="margin-top:2px; font-weight: 500; color: var(--text-main);">${r.store}</div>` : ''}
      </div>`).join('')}
    </div>`;
  }

  // ── Nota de fecha ────────────────────────────────────────────────────────
  const DATE_STATUS_LABELS = {
    official:         '',
    calendar_pattern: '',
    estimated:        'Fecha estimada — pendiente de confirmación',
  };

  function buildSourceNote(insight) {
    const label = DATE_STATUS_LABELS[insight.dateStatus];
    if (!label) return '';
    return `<p class="insight-source-note">${label}</p>`;
  }

  // ── Render de una card (estática, siempre expandida) ────────────────────
  function buildCard(insight, stats) {
    const status     = insight.status;
    const iconSvg    = getIcon(insight.eventId);
    const badge      = buildBadge(insight);
    const metrics    = buildMetrics(insight, stats);
    const sourceNote = buildSourceNote(insight);
    const dateRange  = fmtEventRange(insight.start, insight.end);

    return `<article class="insight-card status-${status}">
      <div class="insight-header">
        <span class="insight-icon">${iconSvg}</span>
        <span class="insight-header-text">
          <span class="insight-event-name">${insight.eventName}</span>
          ${dateRange ? `<div class="insight-source-note" style="margin-top:2px; margin-bottom:2px; font-size:0.75rem;">${dateRange}</div>` : ''}
          ${badge}
        </span>
      </div>
      <div class="insight-body">
        ${metrics}
        ${sourceNote}
      </div>
    </article>`;
  }

  // ── Card resumen histórico (mín/máx de toda la serie) ───────────────────
  function buildSummaryCard(stats) {
    if (!stats) return '';
    const minP = fmtPrice(stats.allTimeMinPrice);
    const maxP = fmtPrice(stats.allTimeMaxPrice);
    const avgP = fmtPrice(stats.allTimeAvgPrice);
    const minD = fmtDateShort(stats.allTimeMinDate);
    const maxD = fmtDateShort(stats.allTimeMaxDate);
    const iconHistory = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    return `<article class="insight-card insight-card--summary" style="grid-column:1/-1">
      <div class="insight-header">
        <span class="insight-icon">${iconHistory}</span>
        <span class="insight-header-text">
          <span class="insight-event-name">Lo más barato y lo más caro que hemos visto</span>
        </span>
      </div>
      <div class="insight-body">
        <div class="insight-metrics">
          <div class="insight-metric">
            <div class="insight-metric-label">⬇️ Precio más bajo</div>
            <div class="insight-metric-value" style="color:var(--success)">${minP}</div>
            <div class="insight-source-note" style="margin-top:4px">${minD}</div>
            ${stats.allTimeMinStore ? `<div class="insight-source-note" style="margin-top:2px; font-weight: 500; color: var(--text-main);"><strong>${stats.allTimeMinStore}</strong></div>` : ''}
          </div>
          <div class="insight-metric">
            <div class="insight-metric-label">⬆️ Precio más alto</div>
            <div class="insight-metric-value">${maxP}</div>
            <div class="insight-source-note" style="margin-top:4px">${maxD}</div>
            ${stats.allTimeMaxStore ? `<div class="insight-source-note" style="margin-top:2px; font-weight: 500; color: var(--text-main);"><strong>${stats.allTimeMaxStore}</strong></div>` : ''}
          </div>
          <div class="insight-metric">
            <div class="insight-metric-label">Precio promedio</div>
            <div class="insight-metric-value">${avgP}</div>
          </div>
          <div class="insight-metric">
            <div class="insight-metric-label">Tienda más barata habitualmente</div>
            <div class="insight-metric-value"><strong>${stats.mostFrequentStore || '—'}</strong></div>
          </div>
        </div>
      </div>
    </article>`;
  }

  function fmtDateShort(dateStr) {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return dateStr; }
  }

  const MONTHS_CAP = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  function fmtEventRange(startStr, endStr) {
    if (!startStr) return '';
    try {
      const dStart = new Date(startStr + 'T00:00:00');
      const dayStart = dStart.getDate();
      const monthStart = MONTHS_CAP[dStart.getMonth()];
      
      if (!endStr || startStr === endStr) {
        return `El ${dayStart} de ${monthStart}`;
      }
      
      const dEnd = new Date(endStr + 'T00:00:00');
      const dayEnd = dEnd.getDate();
      const monthEnd = MONTHS_CAP[dEnd.getMonth()];
      
      if (monthStart === monthEnd) {
        return `Del ${dayStart} al ${dayEnd} de ${monthStart}`;
      } else {
        return `Del ${dayStart} de ${monthStart} al ${dayEnd} de ${monthEnd}`;
      }
    } catch (e) {
      return '';
    }
  }

  // ── Render de la sección completa ────────────────────────────────────────
  function render(insights, stats) {
    const section = document.getElementById('price-insights-section');
    if (!section) return;

    // Solo mostrar eventos con variación real (bajó o subió). Sin cambio = sin valor para el usuario.
    const SHOW_STATUSES = new Set(['strong_drop', 'relevant_drop', 'price_increase']);
    const visible = insights.filter(ins => SHOW_STATUSES.has(ins.status));

    // Mostrar sección si hay stats o eventos con variación; ocultar si no hay nada
    if (!stats && !visible.length) {
      section.style.display = 'none';
      return;
    }

    const grid = document.getElementById('price-insights-grid');
    if (!grid) return;

    const summaryHtml = buildSummaryCard(stats);
    grid.innerHTML = summaryHtml + visible.map(ins => buildCard(ins, stats)).join('');

    section.style.display = '';
  }

  // ── Punto de entrada ─────────────────────────────────────────────────────
  function init() {
    const slug = detectSlug();
    if (!slug) return;

    fetch('/data/price-insights.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        const insights = (data.events || {})[slug] || [];
        const stats    = (data.seriesStats || {})[slug] || null;
        if (!insights.length && !stats) {
          const section = document.getElementById('price-insights-section');
          if (section) section.style.display = 'none';
          return;
        }
        render(insights, stats);
      })
      .catch(function () {
        const section = document.getElementById('price-insights-section');
        if (section) section.style.display = 'none';
      });
  }

  // Iniciamos tan pronto como el DOM esté listo.
  // El script es defer, así que DOMContentLoaded ya pasó o pasará pronto.
  // Usamos consolas-main-loaded como señal principal y un fallback corto.
  var _initiated = false;
  function initOnce() {
    if (_initiated) return;
    _initiated = true;
    init();
  }

  document.addEventListener('consolas-main-loaded', initOnce, { once: true });

  // Fallback: si el evento ya disparó antes de que este script cargara,
  // arrancamos igualmente después de un tick corto.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(initOnce, 200); });
  } else {
    setTimeout(initOnce, 200);
  }

})();
