/** Anonymous, in-memory usage counts. No cookies, storage or cross-page ID. */
(function () {
  "use strict";
  if (!["kamzilu.com", "www.kamzilu.com"].includes(location.hostname) ||
      navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;

  const endpoint = "https://metrics.kamzilu.com/collect";
  const session = crypto.randomUUID();
  const queue = [];
  let sending = false;
  let failures = 0;

  function track(type, data = {}) {
    if (queue.length >= 100) return;
    queue.push({ event_id: crypto.randomUUID(), timestamp: new Date().toISOString(),
      type, session_id: session, page_url: location.origin + location.pathname, ...data });
  }

  async function flush() {
    if (sending || !queue.length || failures >= 3) return;
    sending = true;
    const batch = queue.splice(0, 20);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(batch), keepalive: true, signal: AbortSignal.timeout(8000), credentials: "omit" });
      if (!response.ok) throw new Error("Metrics HTTP " + response.status);
      const result = await response.json();
      if (result.processed !== batch.length || result.errors?.length) throw new Error("Metrics rejected");
      failures = 0;
    } catch (error) {
      failures += 1;
      queue.unshift(...batch.slice(0, Math.max(0, 100 - queue.length)));
    } finally {
      sending = false;
    }
  }

  track("pageview", { page_title: document.title,
    referrer: document.referrer ? new URL(document.referrer).origin : null });
  const reached = new Set();
  window.addEventListener("scroll", () => {
    const height = document.documentElement.scrollHeight - innerHeight;
    if (height <= 0) return;
    const percent = Math.round(scrollY / height * 100);
    [25, 50, 75, 100].forEach(mark => {
      if (percent >= mark && !reached.has(mark)) {
        reached.add(mark);
        track("scroll_depth", { percentage: mark, max_scroll_px: Math.round(scrollY) });
      }
    });
  }, { passive: true });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  window.setInterval(flush, 5000);
  window.KamziluMetrics = { track, flush };
})();
