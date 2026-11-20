// Bundled fonts (inlined into the build) + a loader so canvas art waits for them.
import '@fontsource/luckiest-guy/latin-400.css';
import '@fontsource/patrick-hand/latin-400.css';

export function fontsReady(timeoutMs = 2500) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const load = Promise.all([document.fonts.load('32px "Luckiest Guy"'), document.fonts.load('bold 32px "Patrick Hand"'), document.fonts.load('32px "Patrick Hand"')]);
  return Promise.race([load, new Promise((r) => setTimeout(r, timeoutMs))]).catch(() => {});
}
