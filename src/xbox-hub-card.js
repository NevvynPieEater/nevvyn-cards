/* xbox-hub-card: Xbox console status, player gamerpics and presence, storage, playtime and controls.
 * The artwork is an original crystal-green emitter (no console drawing, no Xbox logo).
 * Gamerpics come from the `entity_picture` attribute of the Xbox presence binary sensors.
 *
 * Card config (everything is optional except `players`):
 *   type: custom:xbox-hub-card
 *   title: Xbox                          # heading
 *   subtitle: Lounge console             # line under the heading
 *   style: auto                          # auto (follows the device) | dark | light
 *   image: /local/xbox.png               # your own picture instead of the built-in graphic: a URL, or a
 *                                        # media upload, e.g. media-source://media_source/local/xbox.png
 *   image_size: 150                      # picture height in px (default 150, width follows)
 *   console: media_player.xbox           # console entity, shown as a chip
 *   in_use: binary_sensor.xbox_in_use    # on = the glow animates (falls back to `console` being on)
 *   chips:                               # extra chips
 *     - { label: TV, entity: sensor.tv_content }
 *     - { label: Period, entity: sensor.tv_period }
 *   players:                             # a name expands to binary_sensor.<n>, sensor.<n>_status, sensor.<n>_friends
 *     - nevvyn
 *     - name: nevvynish
 *       tag: farm                        # small badge
 *       presence: binary_sensor.nevvynish
 *       status: sensor.nevvynish_status
 *       friends: sensor.nevvynish_friends
 *   storage:
 *     - { name: Internal, free: sensor.xbox_free_space_internal_storage, total: sensor.xbox_total_space_internal_storage }
 *   playtime:                            # hours (history_stats) sensors
 *     - { name: today, entity: sensor.xbox_playtime_today }
 *     - { name: last 7 days, entity: sensor.xbox_playtime_7_days }
 *   buttons:                             # script / button / scene entities to run
 *     - { name: Game time, entity: script.game_time, primary: true }
 *     - { name: Game over, entity: script.game_over }
 *   toggle: { name: Farming mode, entity: input_boolean.xbox_farming_mode }
 *   slider: { name: Game volume, entity: input_number.tv_sound_game_volume, unit: dB }
 */
const XHC_CSS = `
:host{display:block;--bg:#f3f8f1;--panel:#ffffff;--ink:#0d1f0d;--mute:#4f6b4f;--line:#cfe3cb;--g1:#107c10;--g2:#3fd13f;--glow:rgba(16,124,16,.35);--warn:#b26a00}
@media (prefers-color-scheme:dark){:host(:not([data-style=light])){--bg:#07110a;--panel:#0d1a10;--ink:#e6f7e3;--mute:#8fb48c;--line:#1f3a22;--g1:#2fbf2f;--g2:#9bf05b;--glow:rgba(120,255,90,.35);--warn:#ffb74d}}
:host([data-style=dark]){--bg:#07110a;--panel:#0d1a10;--ink:#e6f7e3;--mute:#8fb48c;--line:#1f3a22;--g1:#2fbf2f;--g2:#9bf05b;--glow:rgba(120,255,90,.35);--warn:#ffb74d}
*{box-sizing:border-box}
.wrap{background:var(--bg);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:16px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;display:grid;gap:14px}
.hero{display:grid;grid-template-columns:minmax(150px,auto) 1fr;gap:16px;align-items:center;background:linear-gradient(135deg,var(--panel),var(--bg));border:1px solid var(--line);border-radius:14px;padding:14px;overflow:hidden}
.hero svg{width:150px;height:150px}
.hero img.art{max-width:100%;object-fit:contain;display:block;margin:0 auto;filter:drop-shadow(0 0 14px var(--glow))}
.hero img.art.off{opacity:.55;filter:grayscale(.6)}
.title{font-size:22px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;margin:0}
.sub{color:var(--mute);font-size:13px;margin:2px 0 10px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:3px 10px;font-size:12px;display:inline-flex;gap:6px;align-items:center}
.chip b{color:var(--g1)}
.dot{width:8px;height:8px;border-radius:50%;background:var(--mute);display:inline-block}
.dot.on{background:var(--g2);box-shadow:0 0 8px var(--g2)}
.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px}
.panel h3{margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
.big{font-size:26px;font-weight:800;color:var(--g1)}
.bar{height:8px;border-radius:99px;background:var(--line);overflow:hidden;margin:4px 0 8px}
.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--g1),var(--g2))}
.small{font-size:12px;color:var(--mute)}
.btns{display:flex;gap:8px;flex-wrap:wrap}
button{font:inherit;cursor:pointer;border-radius:10px;border:1px solid var(--g1);background:transparent;color:var(--ink);padding:8px 12px;font-weight:600}
button.primary,button.active{background:var(--g1);color:#fff}
button.active{box-shadow:0 0 12px var(--glow)}
input[type=range]{width:100%;accent-color:var(--g1)}
.players{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.pl{display:grid;grid-template-columns:48px 1fr;gap:10px;align-items:center;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:8px}
.pl.off{opacity:.62}
.pl img,.pl .ph{width:48px;height:48px;border-radius:10px;object-fit:cover;background:var(--line);display:block}
.pl .n{font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pl .s{font-size:11px;color:var(--mute);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.tag{font-size:10px;border:1px solid var(--g1);color:var(--g1);border-radius:6px;padding:0 4px;margin-left:4px}
.pulse{animation:xhcp 2.4s ease-in-out infinite;transform-origin:center}
@keyframes xhcp{0%,100%{opacity:.55;transform:scale(.96)}50%{opacity:1;transform:scale(1.03)}}
@media (max-width:520px){.hero{grid-template-columns:1fr;justify-items:center;text-align:center}.chips{justify-content:center}}
`;

class XboxHubCard extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); this._sig = ''; }

  setConfig(config) {
    if (!config || !Array.isArray(config.players) || !config.players.length) {
      throw new Error('xbox-hub-card: set `players` to a list of gamertag names');
    }
    this._cfg = Object.assign({ title: 'Xbox', subtitle: '', style: 'auto' }, config);
    this._players = config.players.map((p) => {
      const o = typeof p === 'string' ? { name: p } : Object.assign({}, p);
      const base = String(o.name || '').toLowerCase();
      o.presence = o.presence || 'binary_sensor.' + base;
      o.status = o.status || 'sensor.' + base + '_status';
      o.friends = o.friends || 'sensor.' + base + '_friends';
      return o;
    });
    if (this._cfg.style === 'dark' || this._cfg.style === 'light') this.setAttribute('data-style', this._cfg.style);
    else this.removeAttribute('data-style');
    this._sig = '';
    this._imgUrl = null; this._imgFor = null;
    if (this._hass) this.hass = this._hass;
  }

  // media-source:// pictures (Home Assistant media uploads) need a signed URL; resolve it, and renew it before it expires.
  _resolveImage() {
    const img = this._cfg && this._cfg.image;
    if (!img || !String(img).startsWith('media-source://') || !this._hass || this._imgFor === img) return;
    this._imgFor = img;
    this._hass.callWS({ type: 'media_source/resolve_media', media_content_id: img, expires: 3600 }).then((r) => {
      this._imgUrl = r && r.url ? r.url : null;
      this._sig = '';
      if (this._hass) this.hass = this._hass;
      clearTimeout(this._imgTimer);
      this._imgTimer = setTimeout(() => { this._imgFor = null; this._resolveImage(); }, 50 * 60 * 1000);
    }).catch(() => { this._imgFor = null; });
  }

  disconnectedCallback() { clearTimeout(this._imgTimer); this._imgFor = null; }

  getCardSize() { return 12; }
  getGridOptions() { return { columns: 'full', min_columns: 6 }; }

  set hass(hass) {
    this._hass = hass;
    if (!this._cfg) return;
    this._resolveImage();
    const sig = this._signature();
    if (sig !== this._sig) { this._sig = sig; this._render(); }
  }

  _s(id) { return id && this._hass.states[id]; }
  _v(id, d) { const s = this._s(id); return s ? s.state : (d === undefined ? 'unavailable' : d); }
  _esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  _ids() {
    const c = this._cfg; const ids = [c.console, c.in_use, c.toggle && c.toggle.entity, c.slider && c.slider.entity];
    (c.chips || []).forEach((x) => ids.push(x.entity));
    (c.storage || []).forEach((x) => ids.push(x.free, x.total));
    (c.playtime || []).forEach((x) => ids.push(x.entity));
    this._players.forEach((p) => ids.push(p.presence, p.status, p.friends));
    return ids.filter(Boolean);
  }

  _signature() {
    return this._ids().map((i) => {
      const s = this._hass.states[i];
      return s ? s.state + (s.attributes && s.attributes.entity_picture ? '|' + s.attributes.entity_picture : '') : '-';
    }).join('~');
  }

  _call(domain, service, data) { this._hass.callService(domain, service, data); }

  _dur(id) {
    const s = this._s(id); if (!s || isNaN(parseFloat(s.state))) return '-';
    const h = parseFloat(s.state); const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
    return hh + 'h ' + String(mm).padStart(2, '0') + 'm';
  }

  _art(on) {
    const raw = this._cfg.image;
    const img = raw && String(raw).startsWith('media-source://') ? this._imgUrl : raw;
    if (img) {
      const h = Number(this._cfg.image_size) || 150;
      return `<img class="art ${on ? '' : 'off'}" src="${this._esc(img)}" alt="" style="height:${h}px">`;
    }
    return `<svg viewBox="0 0 200 200" role="img" aria-label="Crystal green emitter">
      <defs>
        <radialGradient id="xg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#d8ffc0"/><stop offset=".45" stop-color="#3fd13f"/><stop offset="1" stop-color="#0a5a0a" stop-opacity="0"/></radialGradient>
        <linearGradient id="xf1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9bf05b"/><stop offset="1" stop-color="#107c10"/></linearGradient>
        <linearGradient id="xf2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c8ff9a"/><stop offset="1" stop-color="#1f9b1f"/></linearGradient>
      </defs>
      <circle cx="100" cy="100" r="92" fill="url(#xg)" opacity="${on ? 0.55 : 0.18}" class="${on ? 'pulse' : ''}"/>
      <polygon points="100,12 176,56 176,144 100,188 24,144 24,56" fill="none" stroke="#3fd13f" stroke-width="2" opacity="${on ? 0.9 : 0.35}"/>
      <polygon points="100,34 156,67 156,133 100,166 44,133 44,67" fill="none" stroke="#9bf05b" stroke-width="1.5" opacity="${on ? 0.8 : 0.3}"/>
      <polygon points="100,56 100,100 62,78" fill="url(#xf1)" opacity="${on ? 0.95 : 0.4}"/>
      <polygon points="100,56 138,78 100,100" fill="url(#xf2)" opacity="${on ? 0.85 : 0.35}"/>
      <polygon points="62,78 100,100 62,122" fill="url(#xf2)" opacity="${on ? 0.7 : 0.3}"/>
      <polygon points="138,78 138,122 100,100" fill="url(#xf1)" opacity="${on ? 0.7 : 0.3}"/>
      <polygon points="62,122 100,100 100,144" fill="url(#xf1)" opacity="${on ? 0.85 : 0.35}"/>
      <polygon points="138,122 100,144 100,100" fill="url(#xf2)" opacity="${on ? 0.95 : 0.4}"/>
      <circle cx="100" cy="100" r="6" fill="#f4ffe8" opacity="${on ? 1 : 0.4}"/>
    </svg>`;
  }

  _render() {
    const c = this._cfg; const esc = (s) => this._esc(s);
    const consoleState = c.console ? this._v(c.console) : '';
    const on = c.in_use ? this._v(c.in_use) === 'on' : (consoleState !== '' && !['off', 'unavailable', 'unknown', 'standby'].includes(consoleState));
    const chips = [];
    if (c.console) chips.push(`<span class="chip"><span class="dot ${on ? 'on' : ''}"></span>Console <b>${esc(consoleState)}</b></span>`);
    (c.chips || []).forEach((x) => chips.push(`<span class="chip">${esc(x.label || '')} <b>${esc(this._v(x.entity))}</b></span>`));
    const online = this._players.filter((p) => this._v(p.presence) === 'on').length;
    chips.push(`<span class="chip">Online <b>${online}/${this._players.length}</b></span>`);

    const storage = (c.storage || []).map((r) => {
      const free = parseFloat(this._v(r.free)); const total = parseFloat(this._v(r.total));
      if (isNaN(free) || isNaN(total) || total <= 0) return `<div class="small">${esc(r.name)}: unavailable</div>`;
      const pct = Math.max(0, Math.min(100, ((total - free) / total) * 100));
      return `<div><div class="small"><b>${esc(r.name)}</b> ${free.toFixed(0)} free of ${total.toFixed(0)} ${esc(r.unit || 'GiB')}</div><div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div></div>`;
    }).join('');

    const play = c.playtime && c.playtime.length ? `<div class="panel"><h3>Playtime</h3><div class="big">${esc(this._dur(c.playtime[0].entity))}</div><div class="small">${esc(c.playtime[0].name || '')}${c.playtime.slice(1).map((x) => ' · ' + esc(this._dur(x.entity)) + ' ' + esc(x.name || '')).join('')}</div></div>` : '';
    const stor = storage ? `<div class="panel"><h3>Storage</h3>${storage}</div>` : '';

    const btns = (c.buttons || []).map((b, i) => `<button class="${b.primary ? 'primary' : ''}" data-b="${i}">${esc(b.name)}</button>`);
    if (c.toggle) btns.push(`<button data-t="1" class="${this._v(c.toggle.entity) === 'on' ? 'active' : ''}">${esc(c.toggle.name || 'Toggle')}</button>`);
    let slider = '';
    if (c.slider) {
      const e = this._s(c.slider.entity);
      if (e && !isNaN(parseFloat(e.state))) {
        const a = e.attributes || {};
        slider = `<div class="small" style="margin-top:10px">${esc(c.slider.name || 'Level')} <b>${esc(e.state)} ${esc(c.slider.unit || a.unit_of_measurement || '')}</b></div><input type="range" min="${a.min != null ? a.min : 0}" max="${a.max != null ? a.max : 100}" step="${a.step != null ? a.step : 1}" value="${esc(e.state)}">`;
      }
    }
    const ctl = btns.length || slider ? `<div class="panel"><h3>Controls</h3><div class="btns">${btns.join('')}</div>${slider}</div>` : '';

    const players = this._players.map((p) => {
      const b = this._s(p.presence); if (!b) return '';
      const a = b.attributes || {}; const isOn = b.state === 'on';
      const st = this._v(p.status, ''); const fr = this._v(p.friends, '');
      const name = p.label || a.display_name || a.friendly_name || p.name;
      const pic = a.entity_picture ? `<img src="${esc(a.entity_picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="ph"></div>';
      const line = st && st !== 'unknown' && st !== 'unavailable' ? st : (isOn ? 'Online' : 'Offline');
      return `<div class="pl ${isOn ? 'on' : 'off'}">${pic}<div><div class="n"><span class="dot ${isOn ? 'on' : ''}" style="margin-right:6px"></span>${esc(name)}${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ''}</div><div class="s">${esc(line)}${fr && !isNaN(parseFloat(fr)) ? ' · ' + esc(fr) + ' friends' : ''}</div></div></div>`;
    }).join('');

    this.shadowRoot.innerHTML = `<style>${XHC_CSS}</style><div class="wrap">
      <div class="hero">${this._art(on)}<div><h2 class="title">${esc(c.title)}</h2><p class="sub">${esc(c.subtitle || (on ? 'In use' : 'Idle'))}</p><div class="chips">${chips.join('')}</div></div></div>
      <div class="row">${play}${stor}${ctl}</div>
      <div class="panel"><h3>Players</h3><div class="players">${players}</div></div>
    </div>`;

    const r = this.shadowRoot;
    r.querySelectorAll('button[data-b]').forEach((el) => el.addEventListener('click', () => {
      const b = (c.buttons || [])[Number(el.dataset.b)]; if (!b) return;
      const dom = b.entity.split('.')[0];
      this._call(dom, dom === 'script' ? 'turn_on' : dom === 'button' ? 'press' : 'turn_on', { entity_id: b.entity });
    }));
    r.querySelectorAll('button[data-t]').forEach((el) => el.addEventListener('click', () => this._call('homeassistant', 'toggle', { entity_id: c.toggle.entity })));
    const sl = r.querySelector('input[type=range]');
    if (sl) sl.addEventListener('change', () => this._call('input_number', 'set_value', { entity_id: c.slider.entity, value: parseFloat(sl.value) }));
  }
}

if (!customElements.get('xbox-hub-card')) {
  customElements.define('xbox-hub-card', XboxHubCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'xbox-hub-card',
    name: 'Xbox Hub',
    description: 'Xbox console status, player gamerpics and presence, storage, playtime and controls.'
  });
}
