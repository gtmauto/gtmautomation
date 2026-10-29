const KEY = 'gb_coach_seen';

/** First-visit coach mark; dismissed on first interaction; remembered in localStorage (try/catch). */
export function createCoach(el: HTMLElement, okBtn: HTMLButtonElement, canvas: HTMLElement) {
  let seen = false;
  try {
    seen = localStorage.getItem(KEY) === '1';
  } catch {
    /* ignore */
  }
  const dismiss = () => {
    if (el.hidden) return;
    el.hidden = true;
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    canvas.removeEventListener('pointerdown', dismiss);
    canvas.removeEventListener('keydown', dismiss);
  };
  return {
    show() {
      if (seen) return;
      el.hidden = false;
      okBtn.addEventListener('click', dismiss, { once: true });
      canvas.addEventListener('pointerdown', dismiss);
      canvas.addEventListener('keydown', dismiss);
      document.getElementById('pills')?.addEventListener('click', dismiss, { once: true });
    },
    dismiss,
  };
}
