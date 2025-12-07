/**
 * Wink Widget
 * 
 * Creates a floating bubble animation when clicking on the word "foreward" (misspelling of "forward").
 * The gag: It's a visual wink at the typo - when you click on the misspelled word, 
 * a Strange Dream souvenir bubble appears and floats away, acknowledging the intentional error.
 * 
 * Similar to homepage-bubbles.js but triggered on click instead of automatic.
 */

function wink(event) {
    event.preventDefault();
    
    // Create bubble element
    const bubble = document.createElement('div');
    bubble.className = 'wink-bubble';
    
    // Set starting position at click location
    const x = event.clientX;
    const y = event.clientY;

    
    
    bubble.style.position = 'fixed';
    bubble.style.left = x + 'px';
    bubble.style.top = y + 'px';
    bubble.style.width = '60px';
    bubble.style.height = '60px';
    bubble.style.borderRadius = '50%';
    bubble.style.border = '2px solid rgba(255, 255, 255, 0.3)';
    bubble.style.pointerEvents = 'none';
    bubble.style.zIndex = '9999';
    bubble.style.transition = 'all 2s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    bubble.style.opacity = '1';
    
    // Add souvenir image
    const img = document.createElement('img');
    img.src = '/assets/icon_face.png';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.padding = '8px';
    bubble.appendChild(img);
    
    // Add to body
    document.body.appendChild(bubble);
    
    // Animate: float up and fade out
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            bubble.style.transform = `translate(${Math.random() * 200 - 100}px, ${-300 - Math.random() * 200}px) scale(0.5)`;
            bubble.style.opacity = '0';
        });
    });
    
    // Remove after animation
    setTimeout(() => {
        bubble.remove();
    }, 2100);
}

// Make globally available
window.wink = wink;
