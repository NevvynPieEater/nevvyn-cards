/* lcars-data-field: decorative LCARS "data cascade" for wall displays.
 * Paste this block into nevvyn-cards.js (or load it as its own module).
 *
 * Card config:
 *   type: custom:lcars-data-field
 *   rows: 5              # lines of numbers (default 5)
 *   pattern: nnndnnnndnndnnndnnndnn   # n = number column, d = dot column
 *   refresh_seconds: 20  # re-roll the numbers every N seconds (0 = only once)
 *   flicker: 0.32        # fraction of cells that flip colour / highlight (0-1)
 *   line_height: 17      # px per line
 *
 * Light on the panel: the DOM is built once, flicker is pure CSS (step-end
 * keyframes, no transitions), and the optional refresh only rewrites text.
 */
class LcarsDataField extends HTMLElement {
  setConfig(config) {
    this._cfg = Object.assign(
      { rows: 5, pattern: 'nnndnnnndnndnnndnnndnn', refresh_seconds: 20, flicker: 0.32, line_height: 17 },
      config || {}
    );
    this._built = false;
    if (this.isConnected) this._build();
  }

  connectedCallback() {
    if (this._cfg) this._build();
  }

  disconnectedCallback() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  getCardSize() { return 2; }
  getGridOptions() { return { columns: 'full', rows: 2, min_rows: 1 }; }

  _build() {
    if (this._built) return;
    this._built = true;
    const c = this._cfg;
    const pal = ['#9C9CFF', '#9C9CFF', '#FF9F40', '#6D9BC3', '#AFD8E8', '#E0C468', '#C0546A', '#DDE4F0'];
    const rnd = (n) => Math.floor(Math.random() * n);
    const pick = (a) => a[rnd(a.length)];
    const lh = Number(c.line_height) || 17;

    const root = this.shadowRoot || this.attachShadow({ mode: 'open' });
    const cols = c.pattern.split('').map((ch) => (ch === 'd' ? '14px' : 'minmax(0,1fr)')).join(' ');
    root.innerHTML = `
      <style>
        :host { display: block; }
        @keyframes lcHl { 0%,80% { color: var(--c); background: transparent; } 81%,92% { color: #000; background: var(--c); } 93%,100% { color: var(--c); background: transparent; } }
        @keyframes lcCol { 0%,55% { color: var(--c); } 56%,100% { color: var(--d); } }
        .g { display: grid; grid-template-columns: ${cols}; align-items: start; padding: 0 6px; box-sizing: border-box; }
        .n { text-align: right; font-family: Antonio, sans-serif; font-weight: 700; font-size: clamp(11px, 1.5vmin, 16px);
             line-height: ${lh}px; height: ${lh}px; padding: 0 4px; white-space: nowrap; overflow: hidden; color: var(--c); }
        .d { text-align: center; font-size: 9px; line-height: ${lh}px; height: ${lh}px; color: var(--c); }
        .hl { animation: lcHl var(--t) step-end infinite; animation-delay: var(--w); }
        .cc { animation: lcCol var(--t) step-end infinite; animation-delay: var(--w); }
      </style>
      <div class="g"></div>`;
    const grid = root.querySelector('.g');

    this._cells = [];
    for (let r = 0; r < c.rows; r++) {
      for (const ch of c.pattern) {
        const el = document.createElement('div');
        el.className = ch === 'd' ? 'd' : 'n';
        const a = Math.random();
        if (a < c.flicker * 0.45) el.classList.add('hl');
        else if (a < c.flicker) el.classList.add('cc');
        el.style.cssText =
          `--c:${pick(pal)};--d:${pick(pal)};--t:${7 + rnd(14)}s;--w:-${rnd(20)}s;`;
        grid.appendChild(el);
        this._cells.push({ el, dot: ch === 'd' });
      }
    }

    const fill = () => {
      for (const cell of this._cells) {
        if (cell.dot) { cell.el.textContent = Math.random() < 0.55 ? '\u25CF' : ''; continue; }
        let txt = '';
        if (Math.random() > 0.15) {
          const len = pick([2, 3, 3, 4, 4, 5, 5, 6, 8]);
          for (let i = 0; i < len; i++) txt += rnd(10);
        }
        cell.el.textContent = txt;
      }
    };
    fill();
    if (this._timer) clearInterval(this._timer);
    if (Number(c.refresh_seconds) > 0) {
      this._timer = setInterval(() => { if (!document.hidden) fill(); }, Number(c.refresh_seconds) * 1000);
    }
  }
}

if (!customElements.get('lcars-data-field')) {
  customElements.define('lcars-data-field', LcarsDataField);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'lcars-data-field',
    name: 'LCARS data field',
    description: 'Decorative LCARS number cascade for wall displays'
  });
}
