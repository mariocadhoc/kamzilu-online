const section = document.querySelector('.horizontal-scroll-section');
const track = document.getElementById('scroll-track');
const numSlides = 3;
const slideWidth = window.innerWidth;

let currentX = 0;

window.addEventListener('scroll', () => {
  const start = section.offsetTop;
  const end = start + section.offsetHeight - window.innerHeight;
  const scrollY = window.scrollY;

  if (scrollY >= start && scrollY <= end) {
    const progress = (scrollY - start) / (end - start);
    const maxScroll = slideWidth * (numSlides - 1);
    const rawX = progress * maxScroll;

    const snapStep = slideWidth;
    const snappedX = Math.round(rawX / snapStep) * snapStep;

    if (currentX !== snappedX) {
      currentX = snappedX;
      requestAnimationFrame(() => {
        track.style.transform = `translateX(${-currentX}px)`;
      });
    }
  }
});
