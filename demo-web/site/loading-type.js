// Shared by the home scene and the public ward entry.
const lettering = document.querySelector('.loading-type');
const phrase = lettering.textContent;
lettering.setAttribute('aria-label', phrase);
const glyphs = Array.from(phrase, (letter, index) => {
  const span = document.createElement('span');
  span.textContent = letter;
  span.setAttribute('aria-hidden', 'true');
  span.style.setProperty('--delay', index * 75 + 'ms');
  return span;
});
window.loadingLetteringDone = document.fonts.load('48px LoadingPen', phrase).catch(() => {}).then(async () => {
  lettering.classList.add('pen-ready');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lettering.replaceChildren(...glyphs);
  lettering.classList.add('writing');
  const strokes = lettering.getAnimations({subtree:true});
  await Promise.all(strokes.map(stroke => stroke.finished.catch(() => {})));
  lettering.classList.add('shining');
  const sweep = lettering.getAnimations({subtree:true}).find(effect => effect.animationName === 'ink-light');
  if (sweep) await sweep.finished.catch(() => {});
  lettering.classList.remove('shining');
});
