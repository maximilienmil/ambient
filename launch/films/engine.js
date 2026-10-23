// Tiny deterministic timeline. Elements with data-a/data-b (seconds) fade in and
// out; data-y slides them up as they enter. A film may define tick(t) for the rest.
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => 1 - Math.pow(1 - x, 3);
const inout = (x) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const seg = (t, a, b, f = ease) => f(clamp((t - a) / (b - a)));
const lerp = (a, b, p) => a + (b - a) * p;
const $ = (q) => document.querySelector(q);
function type(el, text, p) { const n = Math.round(text.length * clamp(p)); el.textContent = text.slice(0, n); el.classList.toggle('caret', p > 0 && p < 1.15); }
function count(el, to, p, fmt = (n) => n) { el.textContent = fmt(Math.round(to * ease(clamp(p)))); }
window.seek = (t) => {
  for (const e of document.querySelectorAll('[data-a]')) {
    const a = +e.dataset.a, b = +e.dataset.b, f = +(e.dataset.f || .6);
    const o = Math.min(clamp((t - a) / f), clamp((b - t) / f));
    e.style.opacity = o; e.style.visibility = o > 0 ? 'visible' : 'hidden';
    if (e.dataset.y) e.style.translate = `0 ${(1 - ease(clamp((t - a) / (f * 1.8)))) * e.dataset.y}px`;
  }
  if (window.tick) window.tick(t);
  const g = $('.grain'); if (g) g.style.backgroundPosition = `${(Math.floor(t * 12) * 37) % 200}px ${(Math.floor(t * 12) * 61) % 200}px`;
};
addEventListener('DOMContentLoaded', () => { document.body.insertAdjacentHTML('beforeend', '<div class="grain"></div>'); if (!navigator.webdriver) { const s = performance.now(); const loop = () => { seek(((performance.now() - s) / 1000) % DUR); requestAnimationFrame(loop); }; loop(); } });
