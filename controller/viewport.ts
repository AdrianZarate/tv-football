/** Follow browser chrome/keyboard changes without coupling viewport events to the session. */
export function installVisibleViewport() {
  let lastHeight: number | undefined;
  let pending = false;
  const valid = (height: number | undefined): height is number => typeof height === 'number' && Number.isFinite(height) && height >= 1;
  function update() {
    const visual = window.visualViewport?.height;
    const metric = valid(visual) ? visual : window.innerHeight;
    if (!valid(metric)) return; // Keep the last usable size during transient zero-sized resizes.
    const height = Math.floor(metric);
    if (height === lastHeight) return;
    document.documentElement.style.setProperty('--visible-height', `${height}px`);
    lastHeight = height;
  }
  function schedule() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(() => { pending = false; update(); });
  }
  update();
  for (const name of ['resize', 'orientationchange', 'scroll']) window.addEventListener(name, schedule, { passive: true });
  window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  window.visualViewport?.addEventListener('scroll', schedule, { passive: true });
}
