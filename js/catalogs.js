/**
 * Registro de categorías de producto — espejo de backend/catalogs.py.
 *
 * Existe para que ni el loader del PDP ni el llenado de tarjetas del home
 * tengan "consolas" escrito a mano. Agregar una categoría es agregar una
 * entrada aquí y otra en catalogs.py; ningún otro archivo cambia.
 *
 * Se carga antes que el resto de los scripts de página.
 */
(function (global) {
  "use strict";

  var CATALOGS = [
    {
      id: "consolas",
      urlSegment: "consolas",
      apiPath: "/api/consolas",
      dataFile: "/data/consolas.json",
      componentUrl: "/components/consolas_main.html",
      domId: "consolas_main",
      label: "Consolas",
      labelSingular: "CONSOLA"
    },
    {
      id: "gift-cards",
      urlSegment: "gift-cards",
      apiPath: "/api/gift-cards",
      dataFile: "/data/giftcards.json",
      componentUrl: "/components/giftcards_main.html",
      domId: "giftcards_main",
      label: "Gift Cards",
      labelSingular: "GIFT CARD"
    }
  ];

  /**
   * La API en vivo solo permite CORS desde el dominio real de producción, así
   * que cualquier otra vista (localhost, IP de LAN, preview) usa el JSON local.
   */
  function isProduction() {
    return location.hostname === "kamzilu.com" ||
           location.hostname === "www.kamzilu.com";
  }

  function sourceUrl(catalog) {
    if (!catalog) return null;
    return isProduction()
      ? "https://api.kamzilu.com" + catalog.apiPath
      : catalog.dataFile;
  }

  function byId(id) {
    for (var i = 0; i < CATALOGS.length; i++) {
      if (CATALOGS[i].id === id) return CATALOGS[i];
    }
    return null;
  }

  /** Categoría deducida del primer segmento de la URL: /gift-cards/... */
  function fromPath(pathname) {
    var parts = (pathname || location.pathname).split("/").filter(Boolean);
    if (!parts.length) return null;
    for (var i = 0; i < CATALOGS.length; i++) {
      if (CATALOGS[i].urlSegment === parts[0]) return CATALOGS[i];
    }
    return null;
  }

  /** Descarga y combina todas las categorías en un solo objeto slug -> producto. */
  function fetchAll() {
    return Promise.all(CATALOGS.map(function (catalog) {
      return fetch(sourceUrl(catalog))
        .then(function (res) { return res.ok ? res.json() : {}; })
        .catch(function () { return {}; });   // una categoría caída no tumba al resto
    })).then(function (results) {
      var merged = {};
      results.forEach(function (data, index) {
        Object.keys(data || {}).forEach(function (slug) {
          if (!(slug in merged)) {
            merged[slug] = data[slug];
            merged[slug]._catalog = CATALOGS[index].id;
          }
        });
      });
      return merged;
    });
  }

  global.KamziluCatalogs = {
    all: CATALOGS,
    byId: byId,
    fromPath: fromPath,
    sourceUrl: sourceUrl,
    fetchAll: fetchAll,
    isProduction: isProduction
  };
})(window);
