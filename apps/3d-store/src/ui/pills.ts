import type { StoreData } from '../types';
import { bn } from '../i18n/bn';

export interface Pills {
  setActive(id: string): void;
  show(visible: boolean): void;
}

export function createPills(nav: HTMLElement, data: StoreData, onSelect: (id: string) => void): Pills {
  nav.innerHTML = '';
  const items = [{ id: 'store', label: bn.storePill }, ...data.sections.map((s) => ({ id: s.id, label: s.label }))];
  const buttons = new Map<string, HTMLButtonElement>();
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pill';
    b.textContent = it.label;
    b.setAttribute('aria-label', it.id === 'store' ? 'পুরো দোকান দেখুন' : `${it.label} section-এ যান`);
    b.addEventListener('click', () => onSelect(it.id));
    nav.appendChild(b);
    buttons.set(it.id, b);
  }
  return {
    setActive(id) {
      for (const [k, b] of buttons) {
        const on = k === id;
        b.classList.toggle('active', on);
        b.setAttribute('aria-current', on ? 'true' : 'false');
        if (on) b.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      }
    },
    show(v) {
      nav.hidden = !v;
    },
  };
}
