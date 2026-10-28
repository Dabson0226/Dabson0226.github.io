// Title animation

// Anime.js - animation tools
const { animate, splitText, stagger } = anime;

// Split title into words
const { words } = splitText('#mission-title', {
  words: { wrap: 'clip' }
});

// Animate title words
animate(words, {
  y: ['100%', '0%'],
  opacity: [0, 1],
  duration: 1000,
  delay: stagger(150),
  ease: 'out(3)'
});
