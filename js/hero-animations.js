// Script para animar el hero principal separando texto y emojis

document.addEventListener('DOMContentLoaded', () => {
  const heroTitle = document.querySelector('.hero-top h1');
  
  if (!heroTitle) return;
  
  // Obtener el contenido HTML original
  const originalHTML = heroTitle.innerHTML;
  
  // Separar el contenido en partes (texto y emojis)
  // Regex para detectar emojis
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;
  
  // Dividir el HTML por <br> primero
  const lines = originalHTML.split('<br>');
  
  let newHTML = '';
  
  lines.forEach((line, lineIndex) => {
    // Separar cada línea en partes de texto y emojis
    const parts = line.split(emojiRegex);
    
    parts.forEach(part => {
      if (part && part.trim() !== '') {
        // Verificar si es un emoji
        if (emojiRegex.test(part)) {
          newHTML += `<span class="emoji">${part}</span>`;
        } else {
          // Es texto normal
          newHTML += `<span class="text-part">${part}</span>`;
        }
      }
    });
    
    // Agregar <br> excepto en la última línea
    if (lineIndex < lines.length - 1) {
      newHTML += '<br>';
    }
  });
  
  // Actualizar el contenido del h1
  heroTitle.innerHTML = newHTML;
  
  // Opcional: Agregar efecto de partículas al hacer hover en emojis
  const emojis = document.querySelectorAll('.hero-top h1 .emoji');
  
  emojis.forEach(emoji => {
    emoji.addEventListener('mouseenter', () => {
      createSparkles(emoji);
    });
  });
});

// Función opcional para crear efecto de "chispas" alrededor de los emojis
function createSparkles(element) {
  const rect = element.getBoundingClientRect();
  const particles = 6;
  
  for (let i = 0; i < particles; i++) {
    const sparkle = document.createElement('span');
    sparkle.textContent = '✨';
    sparkle.style.position = 'fixed';
    sparkle.style.left = rect.left + rect.width / 2 + 'px';
    sparkle.style.top = rect.top + rect.height / 2 + 'px';
    sparkle.style.fontSize = '1rem';
    sparkle.style.pointerEvents = 'none';
    sparkle.style.zIndex = '9999';
    sparkle.style.opacity = '1';
    
    document.body.appendChild(sparkle);
    
    // Animar partículas
    const angle = (Math.PI * 2 * i) / particles;
    const velocity = 50;
    const tx = Math.cos(angle) * velocity;
    const ty = Math.sin(angle) * velocity;
    
    sparkle.animate([
      {
        transform: 'translate(0, 0) scale(1)',
        opacity: 1
      },
      {
        transform: `translate(${tx}px, ${ty}px) scale(0)`,
        opacity: 0
      }
    ], {
      duration: 800,
      easing: 'ease-out'
    }).onfinish = () => sparkle.remove();
  }
}