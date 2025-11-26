/**
 * Kamzilu Metrics Library
 * Handles user event tracking, batching, and reliable transmission.
 */

(function(window, document) {
    'use strict';

    const CONFIG = {
        endpoint: 'https://metrics.kamzilu.com/collect',
        batchSize: 5,
        batchInterval: 5000, // 5 seconds
        maxRetries: 3
    };

    let queue = [];
    let timer = null;

    // --- Session Management ---
    function getSessionId() {
        let sid = localStorage.getItem('kamzilu_session_id');
        if (!sid) {
            sid = crypto.randomUUID();
            localStorage.setItem('kamzilu_session_id', sid);
            // Track new session / revisit here if needed
        }
        return sid;
    }

    const sessionId = getSessionId();

    // --- Event Queue & Sending ---
    function track(type, data = {}) {
        const event = {
            event_id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            type: type,
            session_id: sessionId,
            page_url: window.location.href,
            ...data
        };

        queue.push(event);
        saveQueue(); // Persist to localStorage in case of crash

        if (queue.length >= CONFIG.batchSize) {
            flush();
        }
    }

    function saveQueue() {
        localStorage.setItem('kamzilu_metrics_queue', JSON.stringify(queue));
    }

    function loadQueue() {
        const saved = localStorage.getItem('kamzilu_metrics_queue');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    queue = parsed;
                }
            } catch (e) {
                console.error("Failed to load metrics queue", e);
            }
        }
    }

    async function flush() {
        if (queue.length === 0) return;

        const batch = [...queue];
        queue = []; // Clear queue temporarily
        saveQueue();

        try {
            const response = await fetch(CONFIG.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(batch),
                keepalive: true // Important for page unload
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Success - nothing to do
        } catch (e) {
            console.warn("Metrics send failed, retrying later", e);
            // Restore batch to queue
            queue = [...batch, ...queue];
            saveQueue();
        }
    }

    // --- Collectors ---

    // 1. Pageview
    function trackPageview() {
        track('pageview', {
            referrer: document.referrer,
            page_title: document.title
        });
    }

    // 2. Scroll Depth
    function initScrollTracking() {
        const marks = [25, 50, 75, 100];
        const reached = new Set();
        let maxScroll = 0;

        window.addEventListener('scroll', () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.round((scrollTop / docHeight) * 100);
            
            maxScroll = Math.max(maxScroll, scrollTop);

            marks.forEach(mark => {
                if (scrollPercent >= mark && !reached.has(mark)) {
                    reached.add(mark);
                    track('scroll_depth', {
                        percentage: mark,
                        max_scroll_px: maxScroll
                    });
                }
            });
        }, { passive: true });
    }

    // 3. Clicks (Delegation)
    function initClickTracking() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Store Click
            const storeLink = target.closest('a[data-metric="store"]');
            if (storeLink) {
                track('click_store', {
                    store_name: storeLink.dataset.store,
                    product_id: storeLink.dataset.productId,
                    price: parseFloat(storeLink.dataset.price || 0),
                    position_in_list: parseInt(storeLink.dataset.position || 0)
                });
            }

            // Card Click
            const card = target.closest('[data-metric="card"]');
            if (card) {
                track('click_card', {
                    product_id: card.dataset.productId,
                    card_type: card.dataset.cardType || 'standard'
                });
            }
        }, true);
    }

    // --- Initialization ---
    loadQueue();
    trackPageview();
    initScrollTracking();
    initClickTracking();

    // Periodic flush
    timer = setInterval(flush, CONFIG.batchInterval);

    // Flush on unload
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush();
        }
    });

    // Expose globally for manual tracking
    window.KamziluMetrics = { track, flush };

})(window, document);
