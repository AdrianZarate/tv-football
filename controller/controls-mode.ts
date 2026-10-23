interface ControlsModeOptions {
  panel: HTMLElement;
  openButton: HTMLButtonElement;
  exitButton: HTMLButtonElement;
  note: HTMLElement;
  canEnter: () => boolean;
  release: () => void;
}

const rotateHint = 'Girá el teléfono para jugar en horizontal. Si el navegador no permite pantalla completa u orientación fija, podés seguir jugando acá.';

/** Presentation only: keeps the live controls, transport and credentials in place. */
export function installControlsMode({ panel, openButton, exitButton, note, canEnter, release }: ControlsModeOptions) {
  const orientation = window.screen?.orientation as (ScreenOrientation & {
    lock?: (value: 'landscape') => Promise<void>;
  }) | undefined;
  let active = false;
  let acquiring = false;
  let exiting = false;
  let ownsFullscreen = false;
  let locking = false;
  let ownsOrientation = false;
  let message = rotateHint;

  function render() {
    const visible = active || ownsFullscreen || exiting;
    panel.dataset.controlsMode = String(visible);
    openButton.hidden = !canEnter() || visible;
    openButton.disabled = !canEnter() || visible;
    exitButton.hidden = !visible;
    note.hidden = !visible || !message;
    note.textContent = message;
  }
  function unlock() {
    if (!ownsOrientation) return;
    ownsOrientation = false;
    try { orientation?.unlock?.(); } catch { /* Display APIs must never stop gameplay or recovery. */ }
  }
  function cleanFullscreen() {
    if (exiting || !ownsFullscreen) return;
    if (document.fullscreenElement !== panel) { ownsFullscreen = false; render(); return; }
    // Relinquish before calling: fullscreenchange can run before the promise settles.
    ownsFullscreen = false;
    exiting = true;
    void (async () => {
      try { await document.exitFullscreen(); }
      catch {
        ownsFullscreen = document.fullscreenElement === panel;
        if (ownsFullscreen) message = 'No se pudo salir de pantalla completa. Tocá Volver de nuevo o usá la salida del navegador.';
      }
      finally { exiting = false; render(); }
    })();
  }
  function exit() {
    if (active) { active = false; release(); }
    unlock();
    cleanFullscreen();
    render();
  }
  function lockLandscape() {
    if (!active || !ownsFullscreen || document.fullscreenElement !== panel || locking || ownsOrientation) return;
    if (typeof orientation?.lock !== 'function') { message = rotateHint; render(); return; }
    locking = true;
    ownsOrientation = true;
    void (async () => {
      try {
        await orientation.lock!('landscape');
        // A pending lock is shared on rapid reentry, never overlapped with another lock.
        if (active && ownsFullscreen && document.fullscreenElement === panel) {
          ownsOrientation = true;
          message = '';
        } else {
          ownsOrientation = true; // A late fulfillment still needs its own cleanup.
          unlock();
        }
      } catch {
        if (active) message = rotateHint;
      } finally { locking = false; render(); }
    })();
  }
  function enter() {
    if (active || !canEnter()) return;
    active = true;
    message = rotateHint;
    release();
    render();
    // Keep one in-flight acquisition. Its result belongs to the current intent,
    // not to an old click: leaving cleans it; reentry may adopt it without retry.
    if (acquiring || exiting) return;
    if (ownsFullscreen && document.fullscreenElement === panel) { lockLandscape(); return; }
    if (document.fullscreenElement || typeof panel.requestFullscreen !== 'function') return;
    acquiring = true;
    void (async () => {
      try {
        await panel.requestFullscreen(); // Called synchronously inside the user gesture.
        if (document.fullscreenElement === panel && !exiting) ownsFullscreen = true;
        if (active) lockLandscape(); else cleanFullscreen();
      } catch {
        if (active) message = rotateHint;
      } finally { acquiring = false; render(); }
    })();
  }
  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === panel) {
      if (acquiring && !exiting) {
        ownsFullscreen = true;
        if (!active) cleanFullscreen();
      }
    } else if (ownsFullscreen) {
      ownsFullscreen = false;
      exit(); // Native Escape, user exit or replacement by another fullscreen owner.
    }
    render();
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') exit(); });
  openButton.addEventListener('click', enter);
  exitButton.addEventListener('click', exit);
  function refresh() { if (!canEnter()) exit(); else render(); }
  render();
  return { exit, refresh };
}
