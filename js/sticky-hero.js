(function initStickyHero() {
    // Only initialize when the specific template event is fired
    document.addEventListener("ConsolaTemplateLoaded", setupStickyHero);

    function setupStickyHero() {
        const heroCard = document.getElementById('hero-price-container');
        if (!heroCard) {
            console.warn('Sticky Hero: Element #hero-price-container not found.');
            return;
        }

        // Prevent double initialization
        if (heroCard.parentNode.id === 'sticky-hero-wrapper') return;

        // Create wrapper to hold space
        const wrapper = document.createElement('div');
        wrapper.id = 'sticky-hero-wrapper';
        wrapper.style.display = 'block';
        wrapper.style.minHeight = '0px';
        wrapper.style.width = '100%';

        // Insert wrapper BEFORE the heroCard and move heroCard inside
        heroCard.insertAdjacentElement("beforebegin", wrapper);
        wrapper.appendChild(heroCard);

        // Header height detection
        const header = document.querySelector('header');
        const headerHeight = header ? header.offsetHeight : 80;

        const observerOptions = {
            root: null,
            threshold: 0,
            rootMargin: `-${headerHeight}px 0px 0px 0px`
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const isPastHeader = entry.boundingClientRect.top <= headerHeight;

                if (!entry.isIntersecting && isPastHeader) {
                    activateSticky();
                } else {
                    deactivateSticky();
                }
            });
        }, observerOptions);

        observer.observe(wrapper);

        function activateSticky() {
            if (heroCard.classList.contains('is-sticky')) return;

            // 1. Clean up potential exit state
            heroCard.classList.remove('is-unsticking');

            // 2. Set wrapper height to matched static height of the card
            wrapper.style.height = `${heroCard.offsetHeight}px`;

            // 3. Apply Sticky
            heroCard.classList.add('is-sticky');
        }

        function deactivateSticky() {
            if (!heroCard.classList.contains('is-sticky')) return;

            // 1. Add Exit Class for animation
            heroCard.classList.add('is-unsticking');

            // 2. Remove Sticky immediately from logical check, 
            // but styling will keep it fixed via .is-unsticking
            heroCard.classList.remove('is-sticky');

            // 3. Wait for animation to finish then clean up
            const duration = 300; // Match CSS animation duration
            setTimeout(() => {
                heroCard.classList.remove('is-unsticking');
                // Release wrapper height
                wrapper.style.height = '';
            }, duration);
        }
    }
})();
