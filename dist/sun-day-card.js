/**
 * sun-day-card.js  v1.1.0
 *
 * A Lovelace card showing the sun's day as an infographic: sunrise / sunset, dawn / dusk, solar noon,
 * an elevation curve with the sun's live position, and (advanced variant) daylight length with the
 * change since yesterday, golden hour, live elevation / azimuth, a countdown to the next event, and
 * a "solar arrays" panel with each array's clear-sky potential curve and live output.
 *
 * Everything is computed in the browser from your Home Assistant latitude / longitude (same maths as
 * the sun integration), so it works for any site with no extra sensors. If sun.sun is available its
 * live elevation / azimuth are used for the sun's position.
 *
 * Install: copy to /config/www/community/nevvyn-cards/sun-day-card.js and add it to the same
 * "ess-cards loader" dashboard resource as the other cards (or add a resource, type module:
 *   /local/community/nevvyn-cards/sun-day-card.js?v=1 ).
 *
 * Simple (looks like the original sun card):
 *   type: custom:sun-day-card
 *   style: light              # light (default, follows your HA theme) | dark (Victron blue) | lcars
 *   line_style: angular       # angular (default, cut corners) | curved (rounded)
 *
 * Advanced:
 *   type: custom:sun-day-card
 *   variant: advanced         # simple (default) | advanced
 *   title: Sun
 *   entity: sun.sun           # optional, default sun.sun (live elevation / azimuth)
 *   time_format: 24h          # optional: 12h | 24h (default follows your HA profile)
 *   sections:                 # advanced only, all default true
 *     stats: true             #   elevation, azimuth, daylight, next event
 *     timeline: true          #   dawn, sunrise, solar noon, golden hour, sunset, dusk
 *     arrays: true            #   needs arrays: below
 *     tiles: true             #   needs tiles: below
 *   arrays:                   # optional - one entry per solar array
 *     - name: Hurstfield house
 *       entity: sensor.solar_house_power        # live power (W or kW)
 *       energy_entity: sensor.solar_house_energy_today   # optional, shown as "today"
 *       peak_w: 3600          # optional: array size in W. Needed for the potential curve and the bar
 *       azimuth: 200          # optional: compass bearing the panels face (180 = south, 90 = east)
 *       tilt: 30              # optional: degrees from flat (default 30). Azimuth + tilt give "sun on panel"
 *       color: "#4fd1ff"      # optional
 *   tiles:                    # optional extra read-only values (moon phase, UV, cloud cover ...)
 *     - entity: sensor.moon_phase
 *       label: Moon
 *   labels: { sunrise: Sunrise }   # optional text overrides (sunrise, sunset, dawn, dusk, noon ...)
 *   latitude: 51.4                 # optional overrides (default: your HA location / time zone)
 *   longitude: -0.4
 *
 * Styling and size (all optional):
 *   font_scale: 1.2           # scales every text size and the padding (0.5 - 3, default 1)
 *   chart_height: 220         # chart height in px (default: a width-based ratio)
 *   arrays_chart_height: 160  # same for the solar arrays chart (advanced)
 *   sun_size: 14              # sun dot radius in px
 *   fit: true                 # fill the card's grid cell and stretch the chart into the spare height.
 *                             #   Resize the card in the sections layout editor (or set grid_options)
 *   show: { header: true, times: true, events: true, chart: true }   # hide or force pieces (all variants)
 *   colors:                   # override any colour for this card
 *     day: "#ffd54f"          #   background, text, text_secondary, surface, line, day, night, curve,
 *     night: "#283593"        #   sun, gold, accent
 *     sun: "#ff7043"
 *   The chart is redrawn at the card's real pixel width, so it stays sharp at any size.
 *   Themes and card-mod can set the same colours as CSS variables: --sdc-day, --sdc-night, --sdc-sun,
 *   --sdc-gold, --sdc-curve, --sdc-bg, --sdc-fg, --sdc-dim, --sdc-surface, --sdc-line, --sdc-accent.
 *
 * Notes: the clear-sky potential curve is geometry (sun angle on the panel) plus air mass - it ignores
 * cloud, shading and temperature, so it is the "what a clear day could give" line, with the dot showing
 * what the array is doing right now.
 */
(() => {
  const VERSION = '1.1.0';
  if (customElements.get('sun-day-card')) return;

  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const mod = (a, n) => ((a % n) + n) % n;
  const pad = (n) => String(n).padStart(2, '0');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
  const VARIANTS = ['simple', 'advanced'];
  const THEMES = ['dark', 'light', 'lcars'];
  const LINE_STYLES = ['curved', 'angular'];
  const PALETTE = ['#4fd1ff', '#ffb347', '#7bd88f', '#c792ea', '#ff7b9c'];
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

  const DEFAULT_LABELS = {
    title: 'Sun',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    dawn: 'Dawn',
    dusk: 'Dusk',
    noon: 'Solar noon',
    golden: 'Golden hour',
    daylight: 'Daylight',
    twilight: 'Twilight',
    night: 'Night',
    elevation: 'Elevation',
    azimuth: 'Azimuth',
    next: 'Next',
    in: 'in',
    arrays: 'Solar arrays',
    potential: 'Clear-sky potential vs now',
    total: 'Total',
    sun_on_panel: 'sun on panel',
    sun_behind: 'sun behind panel',
    today: 'today',
    peak: 'peak',
  };

  /* ---------- solar maths (NOAA) ---------- */

  function solarPos(ms, lat, lon) {
    const jd = ms / 86400000 + 2440587.5;
    const T = (jd - 2451545) / 36525;
    const L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const Mr = M * D2R;
    const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
      Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
    const om = (125.04 - 1934.136 * T) * D2R;
    const lam = (L0 + C - 0.00569 - 0.00478 * Math.sin(om)) * D2R;
    const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    const eps = (eps0 + 0.00256 * Math.cos(om)) * D2R;
    const decl = Math.asin(Math.sin(eps) * Math.sin(lam));
    const y = Math.tan(eps / 2) ** 2;
    const L0r = L0 * D2R;
    const eq = 4 * R2D * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
    const tst = mod(mod(ms / 60000, 1440) + eq + 4 * lon, 1440);
    const ha = (tst / 4 - 180) * D2R;
    const la = lat * D2R;
    const el = Math.asin(clamp(Math.sin(la) * Math.sin(decl) + Math.cos(la) * Math.cos(decl) * Math.cos(ha), -1, 1));
    const zen = Math.PI / 2 - el;
    const den = Math.cos(la) * Math.sin(zen);
    let az = 180;
    if (Math.abs(den) > 1e-9) {
      az = Math.acos(clamp((Math.sin(la) * Math.cos(zen) - Math.sin(decl)) / den, -1, 1)) * R2D;
      az = ha > 0 ? mod(az + 180, 360) : mod(540 - az, 360);
    }
    return { el: el * R2D, az };
  }

  // Local date key and minutes-since-midnight in a time zone.
  function tzParts(d, tz) {
    let p;
    try {
      p = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(d);
    } catch (e) {
      p = new Intl.DateTimeFormat('en-GB', {
        hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }).formatToParts(d);
    }
    const o = {};
    p.forEach((x) => { o[x.type] = x.value; });
    return { key: `${o.year}-${o.month}-${o.day}`, min: (Number(o.hour) % 24) * 60 + Number(o.minute) + Number(o.second) / 60 };
  }

  function scan(startMs, lat, lon) {
    const el = new Float32Array(1441);
    const az = new Float32Array(1441);
    for (let i = 0; i <= 1440; i++) {
      const p = solarPos(startMs + i * 60000, lat, lon);
      el[i] = p.el;
      az[i] = p.az;
    }
    return { el, az };
  }

  function events(el) {
    const cross = (th, dir) => {
      for (let i = 1; i <= 1440; i++) {
        const a = el[i - 1];
        const b = el[i];
        if ((dir > 0 && a < th && b >= th) || (dir < 0 && a >= th && b < th)) return i - 1 + (th - a) / (b - a);
      }
      return null;
    };
    let ni = 0;
    let min = Infinity;
    for (let i = 0; i <= 1440; i++) {
      if (el[i] > el[ni]) ni = i;
      if (el[i] < min) min = el[i];
    }
    return {
      sunrise: cross(-0.833, 1), sunset: cross(-0.833, -1),
      dawn: cross(-6, 1), dusk: cross(-6, -1),
      goldenAmEnd: cross(6, 1), goldenPmStart: cross(6, -1),
      noon: ni, peak: el[ni], min,
    };
  }

  /* ---------- styles ---------- */

  const BASE_CSS = `
    :host { display:block; }
    ha-card { overflow:hidden; background:var(--sc-bg); color:var(--sc-fg); }
    .sc { font-size:calc(1rem * var(--sc-fs, 1)); padding:1em 1.1em .9em; }
    .hd { display:flex; align-items:center; gap:.75em; margin:-1em -1.1em .9em; padding:.9em 1.1em; }
    ha-card.fit { height:100%; }
    ha-card.fit .sc { height:100%; box-sizing:border-box; display:flex; flex-direction:column; }
    ha-card.fit .chw.main { flex:1 1 0; min-height:80px; position:relative; }
    ha-card.fit .chw.main svg.ch { position:absolute; inset:0; width:100%; height:100%; margin:0; }
    ha-card.hide-header .hd { display:none; }
    ha-card.hide-times .times { display:none; }
    ha-card.hide-events .bottom { display:none; }
    ha-card.hide-chart .chw.main { display:none; }
    .hd .t { flex:1; min-width:0; font-weight:700; font-size:1.05em; }
    .pill { font-size:.75em; font-weight:600; padding:4px 10px; border-radius:999px; white-space:nowrap;
            background:var(--sc-surface); border:1px solid var(--sc-line); }
    .pill.p-day { background:color-mix(in srgb, var(--sc-gold) 28%, transparent); }
    .pill.p-tw { background:color-mix(in srgb, var(--sc-night) 40%, transparent); }
    .pill.p-nt { background:color-mix(in srgb, var(--sc-night) 65%, transparent); }
    .times { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
    .times .c { text-align:center; }
    .times .r { text-align:right; }
    .lbl { font-size:1em; opacity:.9; }
    .big { font-size:2em; line-height:1.3; font-weight:400; }
    .sub { font-size:.8em; color:var(--sc-dim); }
    .sub.up { color:var(--sc-ok); } .sub.dn { color:var(--sc-bad); }
    .chw { cursor:pointer; }
    svg.ch { width:100%; height:auto; display:block; margin:6px 0; }
    .bottom { display:flex; justify-content:space-around; text-align:center; margin-top:4px; }
    .bottom .v { font-weight:600; font-size:1.15em; margin-top:6px; }
    .sec { margin:16px 0 0; font-size:.72em; letter-spacing:.08em; text-transform:uppercase; color:var(--sc-dim); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(112px, 1fr)); gap:6px; margin-top:8px; }
    .grid.tl { grid-template-columns:repeat(3, minmax(0, 1fr)); }
    .tile { background:var(--sc-surface); padding:8px 10px; min-width:0; cursor:default; }
    .tile[data-entity] { cursor:pointer; }
    .tile .k { font-size:.68em; text-transform:uppercase; letter-spacing:.06em; color:var(--sc-dim); }
    .tile .v { font-size:1.05em; font-weight:600; overflow-wrap:anywhere; }
    .tile .s { font-size:.74em; color:var(--sc-dim); }
    .tile.next { box-shadow:inset 0 0 0 2px var(--sc-gold); }
    .arr { display:flex; flex-direction:column; gap:6px; margin-top:8px; }
    .ar { display:grid; grid-template-columns:1fr auto; gap:3px 10px; padding:8px 10px; background:var(--sc-surface);
          border-left:6px solid var(--ac); cursor:pointer; }
    .ar .n { font-weight:600; min-width:0; overflow-wrap:anywhere; }
    .ar .w { text-align:right; font-weight:700; }
    .ar .bar { grid-column:1 / -1; height:6px; background:var(--sc-line); border-radius:3px; overflow:hidden; }
    .ar .bar i { display:block; height:100%; background:var(--ac); border-radius:3px; }
    .ar .m { grid-column:1 / -1; font-size:.75em; color:var(--sc-dim); display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap; }
    .ar.tot { border-left-color:var(--sc-accent); cursor:default; }
    .empty { color:var(--sc-dim); padding:6px 0; font-size:.85em; }
    /* svg parts */
    .s-fut { fill:var(--sc-day); opacity:.10; }
    .s-day { fill:var(--sc-day); }
    .s-nt { fill:var(--sc-night); }
    .s-crv { fill:none; stroke:var(--sc-curve); stroke-width:1.4; }
    .s-gold { fill:none; stroke:var(--sc-gold); stroke-width:3.2; stroke-linecap:round; stroke-linejoin:round; }
    .s-mk { stroke:var(--sc-line); stroke-width:1; }
    .s-mk.d { stroke-dasharray:3 4; }
    .s-hz { stroke:var(--sc-line); stroke-width:1.3; }
    .s-now { stroke:var(--sc-sun); stroke-width:1; opacity:.5; stroke-dasharray:2 4; }
    .s-sun { fill:var(--sc-sun); }
    .s-sun.dim { opacity:.55; }
    .s-halo { fill:var(--sc-sun); opacity:.22; }
    .s-ax { fill:var(--sc-dim); font-size:.72em; }
    .s-wl { fill:var(--sc-dim); font-size:.68em; }
    @media (max-width:420px) { .big { font-size:1.6em; } }
  `;

  const CUT = 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))';

  const THEME_CSS = {
    dark: `
      ha-card.dark { --sc-bg:var(--sdc-bg, #0b1526); --sc-fg:var(--sdc-fg, #eaf2ff); --sc-dim:var(--sdc-dim, #9db8dd); --sc-surface:var(--sdc-surface, rgba(255,255,255,.05));
        --sc-line:var(--sdc-line, rgba(255,255,255,.2)); --sc-day:var(--sdc-day, #8fc0ee); --sc-night:var(--sdc-night, #3b3d7a); --sc-curve:var(--sdc-curve, rgba(255,255,255,.4));
        --sc-gold:var(--sdc-gold, #ffb347); --sc-sun:var(--sdc-sun, #f9d05c); --sc-accent:var(--sdc-accent, #0d8bff); --sc-ok:var(--sdc-ok, #3ee08a); --sc-bad:var(--sdc-bad, #ff7b7b);
        border-radius:18px; font-family:var(--paper-font-body1_-_font-family, "Segoe UI", Roboto, sans-serif); }
      .dark .hd { background:linear-gradient(120deg,#062a4d 0%,#0c4a86 45%,#0b3a6b 100%); color:#fff; }
      .dark .tile { border:1px solid rgba(255,255,255,.06); border-radius:10px; }
      .dark .ar { border:1px solid rgba(255,255,255,.06); border-left:6px solid var(--ac); border-radius:10px; }
    `,
    light: `
      ha-card.light { --sc-bg:var(--sdc-bg, var(--ha-card-background, var(--card-background-color, #fff))); --sc-fg:var(--sdc-fg, var(--primary-text-color));
        --sc-dim:var(--sdc-dim, var(--secondary-text-color)); --sc-surface:var(--sdc-surface, var(--secondary-background-color, rgba(127,127,127,.12)));
        --sc-line:var(--sdc-line, var(--divider-color, rgba(127,127,127,.35))); --sc-day:var(--sdc-day, #8fc0ee); --sc-night:var(--sdc-night, #7986cb);
        --sc-curve:var(--sdc-curve, var(--secondary-text-color)); --sc-gold:var(--sdc-gold, #fb8c00); --sc-sun:var(--sdc-sun, #fbc02d);
        --sc-accent:var(--sdc-accent, var(--primary-color, #03a9f4)); --sc-ok:var(--sdc-ok, var(--success-color, #43a047)); --sc-bad:var(--sdc-bad, var(--error-color, #e53935));
        font-family:var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, sans-serif)); }
      .light .hd { padding-top:4px; padding-bottom:0; margin-top:-4px; }
      .light .tile { border-left:6px solid var(--sc-accent); }
      .light.ls-angular .tile, .light.ls-angular .ar { clip-path:${CUT}; }
      .light.ls-curved .tile, .light.ls-curved .ar { border-radius:12px; }
    `,
    lcars: `
      ha-card.lcars { --lc-o:#ff9900; --lc-p:#ffcc99; --lc-v:#cc99cc; --lc-b:#9999ff; --lc-t:#ffcc66; --lc-r:#cc6666; --lc-g:#99cc99;
        --sc-bg:var(--sdc-bg, #000); --sc-fg:var(--sdc-fg, var(--lc-p)); --sc-dim:var(--sdc-dim, var(--lc-v)); --sc-surface:var(--sdc-surface, #14101c); --sc-line:var(--sdc-line, #5b4a78);
        --sc-day:var(--sdc-day, var(--lc-o)); --sc-night:var(--sdc-night, #5b4a78); --sc-curve:var(--sdc-curve, var(--lc-v)); --sc-gold:var(--sdc-gold, var(--lc-t)); --sc-sun:var(--sdc-sun, #fff);
        --sc-accent:var(--sdc-accent, var(--lc-o)); --sc-ok:var(--sdc-ok, var(--lc-g)); --sc-bad:var(--sdc-bad, var(--lc-r));
        border-radius:36px 8px 8px 8px; font-family:Antonio, Okuda, "Helvetica Neue", Arial, sans-serif;
        letter-spacing:.05em; text-transform:uppercase; }
      .lcars .sc { padding-top:1.1em; }
      .lcars .sc.nohd::before { content:""; display:block; height:8px; margin:-8px 0 14px;
        background:linear-gradient(90deg, var(--lc-o) 0 86px, #000 86px 92px, var(--lc-v) 92px 55%, #000 55% calc(55% + 6px), var(--lc-b) calc(55% + 6px) 100%); }
      .lcars .hd { position:relative; gap:0; padding:0; min-height:52px; align-items:stretch; margin:-1.1em -1.1em 1.2em; background:#000; }
      .lcars .hd::before { content:""; flex:0 0 86px; background:var(--lc-o); border-radius:36px 0 0 0; margin-right:8px; }
      .lcars .hd::after { content:""; position:absolute; left:0; right:0; bottom:-7px; height:6px;
        background:linear-gradient(90deg, var(--lc-o) 0 86px, #000 86px 92px, var(--lc-v) 92px 55%, #000 55% calc(55% + 6px), var(--lc-b) calc(55% + 6px) 100%); }
      .lcars .hd .t { align-self:center; color:var(--lc-o); font-size:1.4em; font-weight:400; letter-spacing:.12em; }
      .lcars .pill { align-self:center; margin-right:14px; border:0; border-radius:0 18px 18px 0; background:var(--lc-v); color:#000; padding:5px 16px 5px 12px; font-size:.9em; font-weight:400; }
      .lcars .pill.p-day { background:var(--lc-t); } .lcars .pill.p-tw { background:var(--lc-b); } .lcars .pill.p-nt { background:var(--lc-v); }
      .lcars .lbl { color:var(--lc-v); letter-spacing:.12em; }
      .lcars .big { color:var(--lc-p); font-weight:400; letter-spacing:.06em; }
      .lcars .bottom .v { font-weight:400; color:var(--lc-p); }
      .lcars .sec { color:var(--lc-o); font-size:.85em; letter-spacing:.14em; display:flex; align-items:center; gap:10px; }
      .lcars .sec::before { content:""; flex:none; width:40px; height:12px; border-radius:6px 0 0 6px; background:var(--lc-o); }
      .lcars .sec::after { content:""; flex:1; height:4px; background:#2a2238; }
      .lcars .tile, .lcars .ar { border-left:8px solid var(--lc-o); clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%); }
      .lcars .ar { border-left-color:var(--ac); }
      .lcars .tile:nth-child(4n+2) { border-left-color:var(--lc-v); }
      .lcars .tile:nth-child(4n+3) { border-left-color:var(--lc-b); }
      .lcars .tile:nth-child(4n+4) { border-left-color:var(--lc-t); }
      .lcars .tile .v { font-weight:400; font-size:1.2em; color:var(--lc-p); }
      .lcars .tile.next { box-shadow:none; background:#241a30; }
      .lcars .s-hz, .lcars .s-mk { stroke:#5b4a78; }
      .lcars .sub { letter-spacing:.04em; }
    `,
  };

  /* ---------- the card ---------- */

  class SunDayCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = null;
      this._hass = null;
      this._day = null;
      this._sig = null;
      this._timer = null;
      this._uid = 'sdc' + Math.random().toString(36).slice(2, 8);
    }

    static getStubConfig() {
      return { variant: 'simple' };
    }

    setConfig(config) {
      if (!config || typeof config !== 'object') throw new Error('sun-day-card: invalid configuration');
      const variant = config.variant === undefined ? 'simple' : config.variant;
      if (!VARIANTS.includes(variant)) throw new Error(`sun-day-card: variant must be ${VARIANTS.join(' or ')} (got "${variant}")`);
      const style = config.style === undefined ? 'light' : config.style === 'normal' ? 'light' : config.style;
      if (!THEMES.includes(style)) throw new Error(`sun-day-card: style must be ${THEMES.join(', ')} (got "${config.style}")`);
      if (config.line_style !== undefined && !LINE_STYLES.includes(config.line_style)) {
        throw new Error(`sun-day-card: line_style must be curved or angular (got "${config.line_style}")`);
      }
      const lineStyle = config.line_style || (style === 'lcars' ? 'angular' : 'angular');
      const entity = config.entity === undefined ? 'sun.sun' : config.entity;
      if (entity && !ENTITY_RE.test(entity)) throw new Error(`sun-day-card: entity "${entity}" is not a valid entity_id`);

      let arrays = [];
      if (config.arrays !== undefined) {
        if (!Array.isArray(config.arrays)) throw new Error('sun-day-card: "arrays" must be a list');
        arrays = config.arrays.map((a, i) => {
          if (!a || typeof a.entity !== 'string' || !ENTITY_RE.test(a.entity)) {
            throw new Error(`sun-day-card: arrays[${i}].entity must be a valid entity_id`);
          }
          if (a.energy_entity && !ENTITY_RE.test(a.energy_entity)) {
            throw new Error(`sun-day-card: arrays[${i}].energy_entity must be a valid entity_id`);
          }
          const num = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
          return {
            ...a,
            peak_w: num(a.peak_w),
            azimuth: num(a.azimuth),
            tilt: num(a.tilt) === null ? 30 : num(a.tilt),
            color: a.color || PALETTE[i % PALETTE.length],
          };
        });
      }
      let tiles = [];
      if (config.tiles !== undefined) {
        if (!Array.isArray(config.tiles)) throw new Error('sun-day-card: "tiles" must be a list');
        tiles = config.tiles.map((t, i) => {
          const item = typeof t === 'string' ? { entity: t } : { ...t };
          if (!item.entity || !ENTITY_RE.test(item.entity)) throw new Error(`sun-day-card: tiles[${i}].entity must be a valid entity_id`);
          return item;
        });
      }
      const numOpt = (v, lo, hi) => {
        const n = Number(v);
        return v === undefined || v === null || v === '' || !Number.isFinite(n) ? null : clamp(n, lo, hi);
      };
      const COLOR_VARS = { background: 'bg', text: 'fg', text_secondary: 'dim', surface: 'surface', line: 'line',
        day: 'day', night: 'night', curve: 'curve', sun: 'sun', gold: 'gold', accent: 'accent' };
      const fontScale = numOpt(config.font_scale, 0.5, 3) || 1;
      let vars = `--sc-fs:${fontScale};`;
      if (config.colors !== undefined) {
        if (!config.colors || typeof config.colors !== 'object' || Array.isArray(config.colors)) {
          throw new Error('sun-day-card: "colors" must be a map of name: colour');
        }
        Object.entries(config.colors).forEach(([k, v]) => {
          if (!COLOR_VARS[k]) throw new Error(`sun-day-card: colors.${k} is not a colour name (use ${Object.keys(COLOR_VARS).join(', ')})`);
          if (!/^[^;{}<>"'\\]{1,60}$/.test(String(v))) throw new Error(`sun-day-card: colors.${k} is not a valid CSS colour`);
          vars += `--sc-${COLOR_VARS[k]}:${v};`;
        });
      }
      const show = { header: undefined, times: true, events: true, chart: true, ...(config.show || {}) };
      const cardClass = [style, `ls-${lineStyle}`, config.fit === true ? 'fit' : '',
        show.header === false ? 'hide-header' : '', show.times === false ? 'hide-times' : '',
        show.events === false ? 'hide-events' : '', show.chart === false ? 'hide-chart' : ''].filter(Boolean).join(' ');
      this._config = {
        ...config,
        variant,
        style,
        line_style: lineStyle,
        entity,
        arrays,
        tiles,
        sections: { stats: true, timeline: true, arrays: true, tiles: true, ...(config.sections || {}) },
        labels: { ...DEFAULT_LABELS, ...(config.labels || {}) },
        font_scale: fontScale,
        chart_height: numOpt(config.chart_height, 80, 800),
        arrays_chart_height: numOpt(config.arrays_chart_height, 80, 600),
        sun_size: numOpt(config.sun_size, 4, 40),
        fit: config.fit === true,
        show,
      };
      this.shadowRoot.innerHTML = `
        <style>${BASE_CSS}${THEME_CSS[style]}</style>
        <ha-card class="${cardClass}" style="${esc(vars)}"><div class="sc" id="root"></div></ha-card>`;
      this._root = this.shadowRoot.getElementById('root');
      this.style.height = config.fit === true ? '100%' : '';
      this._root.addEventListener('click', (ev) => {
        const el = ev.target.closest('[data-entity]');
        if (!el) return;
        this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
      });
      this._day = null;
      this._sig = null;
      this._cw = 0;
      this._chh = 0;
      this._observe();
      if (this._hass) this._update();
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    connectedCallback() {
      if (!this._timer) this._timer = setInterval(() => this._update(), 60000);
      if (this._root) this._observe();
    }

    disconnectedCallback() {
      if (this._timer) clearInterval(this._timer);
      this._timer = null;
      if (this._ro) this._ro.disconnect();
      this._ro = null;
    }

    // Watches the card's size so the chart can be redrawn at its real pixel size (and, in fit mode,
    // stretched into whatever height the grid gives the card).
    _observe() {
      if (this._ro) { this._ro.disconnect(); this._ro = null; }
      const card = this.shadowRoot && this.shadowRoot.querySelector('ha-card');
      if (!card || typeof ResizeObserver === 'undefined') return;
      this._ro = new ResizeObserver(() => this._measure());
      this._ro.observe(card);
    }

    _measure() {
      if (!this._root || !this._config) return;
      const cs = getComputedStyle(this._root);
      const w = Math.round(this._root.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
      let h = 0;
      if (this._config.fit) {
        const chw = this._root.querySelector('.chw.main');
        if (chw) h = Math.round(chw.clientHeight);
      }
      const wChanged = w > 0 && Math.abs(w - this._cw) >= 4;
      const hChanged = this._config.fit && h >= 80 && Math.abs(h - this._chh) >= 3;
      if (!wChanged && !hChanged) return;
      if (wChanged) this._cw = w;
      if (hChanged) this._chh = h;
      this._sig = null;
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this._update());
    }

    _dims(adv) {
      const c = this._config;
      const W = this._cw >= 240 ? this._cw : this._cw ? 240 : 600;
      let H;
      if (c.fit && this._chh >= 80) H = this._chh;
      else if (c.chart_height) H = c.chart_height;
      else H = Math.round(W * (adv ? 0.35 : 0.33));
      return { W, H: Math.max(100, H) };
    }

    _sunR(W, adv) {
      const c = this._config;
      if (c.sun_size) return c.sun_size;
      return Math.round((adv ? 10 : 15) * clamp(W / 600, 0.75, 1.4));
    }

    getCardSize() {
      const c = this._config;
      if (!c) return 4;
      return c.variant === 'advanced' ? 8 + c.arrays.length : 4;
    }

    getGridOptions() {
      if (this._config && this._config.fit) return { columns: 12, min_columns: 3, rows: 4, min_rows: 2 };
      return { columns: 12, min_columns: 3, rows: 'auto' };
    }

    /* --- helpers --- */

    _h12() {
      const c = this._config;
      if (c.time_format) return c.time_format === '12h';
      const tf = this._hass && this._hass.locale && this._hass.locale.time_format;
      if (tf === '12') return true;
      if (tf === '24') return false;
      try {
        return !!new Intl.DateTimeFormat((this._hass && this._hass.locale && this._hass.locale.language) || undefined, { hour: 'numeric' }).resolvedOptions().hour12;
      } catch (e) { return false; }
    }

    _hm(m, h12) {
      if (m === null || m === undefined || !Number.isFinite(m)) return '—';
      const t = mod(Math.round(m), 1440);
      const h = Math.floor(t / 60);
      const mi = t % 60;
      if (h12) return `${h % 12 || 12}:${pad(mi)} ${h < 12 ? 'am' : 'pm'}`;
      return `${pad(h)}:${pad(mi)}`;
    }

    _dur(min) {
      if (!Number.isFinite(min)) return '—';
      const t = Math.max(0, Math.round(min));
      const h = Math.floor(t / 60);
      return h ? `${h}h ${pad(t % 60)}m` : `${t % 60}m`;
    }

    _watts(st) {
      if (!st || st.state === 'unavailable' || st.state === 'unknown') return null;
      const v = parseFloat(st.state);
      if (!Number.isFinite(v)) return null;
      const u = String((st.attributes && st.attributes.unit_of_measurement) || 'W').toLowerCase();
      return u === 'kw' ? v * 1000 : u === 'mw' ? v * 1e6 : v;
    }

    _fmtW(w) {
      if (w === null) return '—';
      return Math.abs(w) >= 1000 ? `${(w / 1000).toFixed(2)} kW` : `${Math.round(w)} W`;
    }

    _fmtState(st) {
      if (!st) return '—';
      if (this._hass && typeof this._hass.formatEntityState === 'function') {
        try { return this._hass.formatEntityState(st); } catch (e) { /* fall through */ }
      }
      const u = st.attributes && st.attributes.unit_of_measurement;
      return u ? `${st.state} ${u}` : st.state;
    }

    // cos of the angle between the sun and the panel normal (0 when behind the panel or the sun is down)
    _incidence(el, az, arr) {
      if (el <= 0 || arr.azimuth === null) return null;
      const e = el * D2R, a = az * D2R, b = arr.tilt * D2R, g = arr.azimuth * D2R;
      const sx = Math.cos(e) * Math.sin(a), sy = Math.cos(e) * Math.cos(a), sz = Math.sin(e);
      const nx = Math.sin(b) * Math.sin(g), ny = Math.sin(b) * Math.cos(g), nz = Math.cos(b);
      return Math.max(0, sx * nx + sy * ny + sz * nz);
    }

    _potential(day, arr) {
      const out = [];
      for (let i = 0; i <= 1440; i += 10) {
        const el = day.el[i];
        const c = this._incidence(el, day.az[i], arr);
        if (c === null || el <= 0 || !arr.peak_w) { out.push(0); continue; }
        const am = Math.min(38, 1 / Math.sin(el * D2R));
        const f = Math.pow(0.7, Math.pow(am, 0.678)) / 0.7;
        out.push(arr.peak_w * f * c);
      }
      return out;
    }

    /* --- update loop --- */

    _update() {
      if (!this._hass || !this._config || !this._root) return;
      const h = this._hass;
      const cfg = this._config;
      const lat = Number.isFinite(Number(cfg.latitude)) && cfg.latitude !== undefined ? Number(cfg.latitude) : h.config.latitude;
      const lon = Number.isFinite(Number(cfg.longitude)) && cfg.longitude !== undefined ? Number(cfg.longitude) : h.config.longitude;
      const tz = cfg.time_zone || h.config.time_zone;
      const now = new Date();
      const tp = tzParts(now, tz);
      const key = `${tp.key}|${lat}|${lon}`;
      if (!this._day || this._day.key !== key) {
        const start = now.getTime() - tp.min * 60000;
        const today = scan(start, lat, lon);
        const yest = scan(start - 86400000, lat, lon);
        const ev = events(today.el);
        const yev = events(yest.el);
        this._day = {
          key, el: today.el, az: today.az, ev,
          len: ev.sunrise !== null && ev.sunset !== null ? ev.sunset - ev.sunrise : null,
          ylen: yev.sunrise !== null && yev.sunset !== null ? yev.sunset - yev.sunrise : null,
        };
      }
      const day = this._day;
      const st = cfg.entity ? h.states[cfg.entity] : undefined;
      const comp = solarPos(now.getTime(), lat, lon);
      const attrEl = st ? parseFloat(st.attributes && st.attributes.elevation) : NaN;
      const attrAz = st ? parseFloat(st.attributes && st.attributes.azimuth) : NaN;
      const elev = Number.isFinite(attrEl) ? attrEl : comp.el;
      const az = Number.isFinite(attrAz) ? attrAz : comp.az;

      const arrs = cfg.arrays.map((a) => {
        const s = h.states[a.entity];
        const es = a.energy_entity ? h.states[a.energy_entity] : null;
        return { a, w: this._watts(s), energy: es ? this._fmtState(es) : null, inc: this._incidence(elev, az, a) };
      });
      const tiles = cfg.tiles.map((t) => ({ t, st: h.states[t.entity] }));

      const sig = [
        Math.floor(tp.min), elev.toFixed(1), az.toFixed(0), key, this._h12(), this._cw, this._chh,
        arrs.map((x) => `${x.w}|${x.energy}`).join(','),
        tiles.map((x) => (x.st ? x.st.state : '')).join(','),
      ].join('#');
      if (sig === this._sig) return;
      this._sig = sig;
      this._root.innerHTML = this._render({ cfg, day, nowMin: tp.min, elev, az, arrs, tiles });
    }

    /* --- rendering --- */

    _chart(day, nowMin, elev, adv) {
      const { W, H } = this._dims(adv);
      const fs = Math.max(1, this._config.font_scale);
      const r = this._sunR(W, adv);
      const px = 14;
      const top = Math.max(r + 6, Math.round((adv ? 18 : 24) * fs));
      const bot = H - Math.round((adv ? 22 : 8) * (adv ? fs : 1));
      const X = (m) => px + (m / 1440) * (W - 2 * px);
      const peak = Math.max(day.ev.peak, 3);
      const yMax = peak * 1.12;
      const yMin = Math.max(day.ev.min, -Math.max(12, peak * 0.6));
      const Y = (e) => top + ((yMax - clamp(e, yMin, yMax)) / (yMax - yMin)) * (bot - top);
      const y0 = Y(0);
      const f1 = (n) => n.toFixed(1);
      const pts = [];
      for (let i = 0; i <= 1440; i += 10) pts.push([X(i), day.el[i]]);
      const line = 'M' + pts.map((p) => `${f1(p[0])},${f1(Y(p[1]))}`).join('L');
      const area = (fn) => 'M' + pts.map((p) => `${f1(p[0])},${f1(Y(fn(p[1])))}`).join('L') +
        `L${f1(pts[pts.length - 1][0])},${f1(y0)}L${f1(pts[0][0])},${f1(y0)}Z`;
      const nowX = X(nowMin);
      const uid = this._uid;
      let gold = '';
      if (adv) {
        let run = [];
        const flush = () => { if (run.length > 1) gold += 'M' + run.join('L'); run = []; };
        pts.forEach((p) => {
          if (p[1] >= 0 && p[1] <= 6) run.push(`${f1(p[0])},${f1(Y(p[1]))}`); else flush();
        });
        flush();
      }
      const ev = day.ev;
      const mk = [];
      if (ev.sunrise !== null) mk.push(`<line class="s-mk" x1="${f1(X(ev.sunrise))}" x2="${f1(X(ev.sunrise))}" y1="${top}" y2="${f1(y0)}"/>`);
      if (ev.sunset !== null) mk.push(`<line class="s-mk" x1="${f1(X(ev.sunset))}" x2="${f1(X(ev.sunset))}" y1="${top}" y2="${f1(y0)}"/>`);
      if (adv) {
        [ev.dawn, ev.dusk].forEach((m) => {
          if (m !== null) mk.push(`<line class="s-mk d" x1="${f1(X(m))}" x2="${f1(X(m))}" y1="${f1(y0)}" y2="${f1(y0 + (bot - y0) * 0.65)}"/>`);
        });
        mk.push(`<line class="s-mk d" x1="${f1(X(ev.noon))}" x2="${f1(X(ev.noon))}" y1="${f1(Y(ev.peak))}" y2="${bot}"/>`);
      }
      const dim = elev < -0.833 ? ' dim' : '';
      let axis = '';
      if (adv) {
        [0, 6, 12, 18, 24].forEach((hr) => {
          const anchor = hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle';
          axis += `<text class="s-ax" x="${f1(X(hr * 60))}" y="${H - 6}" text-anchor="${anchor}">${pad(hr % 24)}</text>`;
        });
      }
      return `
        <svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Sun elevation through the day">
          <defs><clipPath id="${uid}-p"><rect x="0" y="0" width="${f1(nowX)}" height="${H}"/></clipPath></defs>
          <path class="s-fut" d="${area((e) => Math.max(e, 0))}"/>
          <g clip-path="url(#${uid}-p)">
            <path class="s-day" d="${area((e) => Math.max(e, 0))}"/>
            <path class="s-nt" d="${area((e) => Math.min(e, 0))}"/>
          </g>
          ${mk.join('')}
          <line class="s-hz" x1="${px}" x2="${W - px}" y1="${f1(y0)}" y2="${f1(y0)}"/>
          <path class="s-crv" d="${line}"/>
          ${gold ? `<path class="s-gold" d="${gold}"/>` : ''}
          ${adv ? `<line class="s-now" x1="${f1(nowX)}" x2="${f1(nowX)}" y1="${top}" y2="${bot}"/>` : ''}
          <circle class="s-halo" cx="${f1(nowX)}" cy="${f1(Y(elev))}" r="${r + 5}"/>
          <circle class="s-sun${dim}" cx="${f1(nowX)}" cy="${f1(Y(elev))}" r="${r}"/>
          ${axis}
        </svg>`;
    }

    _arrChart(day, nowMin, arrs) {
      const { W } = this._dims(true);
      const H = Math.max(100, Math.round(this._config.arrays_chart_height || W * 0.24));
      const px = 14, top = 14, bot = H - Math.round(22 * Math.max(1, this._config.font_scale));
      const X = (m) => px + (m / 1440) * (W - 2 * px);
      const pots = arrs.map((x) => (x.a.peak_w ? this._potential(day, x.a) : null));
      let maxW = 1;
      pots.forEach((p) => { if (p) p.forEach((v) => { if (v > maxW) maxW = v; }); });
      arrs.forEach((x) => { if (x.w !== null && x.w > maxW) maxW = x.w; });
      maxW *= 1.08;
      const Y = (w) => top + (1 - clamp(w, 0, maxW) / maxW) * (bot - top);
      const f1 = (n) => n.toFixed(1);
      const nowX = X(nowMin);
      let body = '';
      arrs.forEach((x, i) => {
        const p = pots[i];
        if (p) {
          const d = 'M' + p.map((v, k) => `${f1(X(k * 10))},${f1(Y(v))}`).join('L');
          body += `<path d="${d}L${f1(X(1440))},${bot}L${f1(X(0))},${bot}Z" fill="${esc(x.a.color)}" opacity=".16"/>`;
          body += `<path d="${d}" fill="none" stroke="${esc(x.a.color)}" stroke-width="1.8"/>`;
        }
        if (x.w !== null) {
          body += `<circle cx="${f1(nowX)}" cy="${f1(Y(x.w))}" r="6.5" fill="${esc(x.a.color)}" stroke="var(--sc-bg)" stroke-width="2"/>`;
        }
      });
      let axis = '';
      [0, 6, 12, 18, 24].forEach((hr) => {
        const anchor = hr === 0 ? 'start' : hr === 24 ? 'end' : 'middle';
        axis += `<text class="s-ax" x="${f1(X(hr * 60))}" y="${H - 6}" text-anchor="${anchor}">${pad(hr % 24)}</text>`;
      });
      return `
        <svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Solar array potential">
          <line class="s-hz" x1="${px}" x2="${W - px}" y1="${bot}" y2="${bot}"/>
          <line class="s-now" x1="${f1(nowX)}" x2="${f1(nowX)}" y1="${top}" y2="${bot}"/>
          ${body}
          <text class="s-wl" x="${px}" y="${top - 2}">${esc(this._fmtW(maxW / 1.08))}</text>
          ${axis}
        </svg>`;
    }

    _render({ cfg, day, nowMin, elev, az, arrs, tiles }) {
      const L = cfg.labels;
      const h12 = this._h12();
      const hm = (m) => this._hm(m, h12);
      const ev = day.ev;
      const adv = cfg.variant === 'advanced';
      const status = elev > -0.833 ? 'day' : elev > -6 ? 'tw' : 'nt';
      const statusText = status === 'day' ? L.daylight : status === 'tw' ? L.twilight : L.night;
      const showHd = cfg.show.header === true || adv || !!cfg.title;
      const sunEntity = cfg.entity ? ` data-entity="${esc(cfg.entity)}"` : '';

      // next event
      const seq = [
        { k: 'dawn', label: L.dawn, m: ev.dawn },
        { k: 'sunrise', label: L.sunrise, m: ev.sunrise },
        { k: 'noon', label: L.noon, m: ev.noon },
        { k: 'golden', label: L.golden, m: ev.goldenPmStart },
        { k: 'sunset', label: L.sunset, m: ev.sunset },
        { k: 'dusk', label: L.dusk, m: ev.dusk },
      ].filter((x) => x.m !== null);
      let next = seq.find((x) => x.m > nowMin);
      let nextIn = next ? next.m - nowMin : null;
      if (!next && seq.length) {
        next = seq[0];
        nextIn = 1440 - nowMin + next.m;
      }

      let html = '';
      if (showHd) {
        html += `<div class="hd"><div class="t">${esc(cfg.title || L.title)}</div><div class="pill p-${status}">${esc(statusText)}</div></div>`;
      }

      if (!adv) {
        html += `
          <div class="times">
            <div><div class="lbl">${esc(L.sunrise)}</div><div class="big">${hm(ev.sunrise)}</div></div>
            <div class="r"><div class="lbl">${esc(L.sunset)}</div><div class="big">${hm(ev.sunset)}</div></div>
          </div>
          <div class="chw main"${sunEntity}>${this._chart(day, nowMin, elev, false)}</div>
          <div class="bottom">
            <div><div class="lbl">${esc(L.dawn)}</div><div class="v">${hm(ev.dawn)}</div></div>
            <div><div class="lbl">${esc(L.noon)}</div><div class="v">${hm(ev.noon)}</div></div>
            <div><div class="lbl">${esc(L.dusk)}</div><div class="v">${hm(ev.dusk)}</div></div>
          </div>`;
        return html;
      }

      // advanced: daylight length and change since yesterday
      let delta = '';
      if (day.len !== null && day.ylen !== null) {
        const d = (day.len - day.ylen) * 60; // seconds
        const s = Math.abs(Math.round(d));
        const txt = `${d >= 0 ? '+' : '−'}${Math.floor(s / 60)}m ${pad(s % 60)}s`;
        delta = `<div class="sub ${d >= 0 ? 'up' : 'dn'}">${txt}</div>`;
      }
      html += `
        <div class="times">
          <div><div class="lbl">${esc(L.sunrise)}</div><div class="big">${hm(ev.sunrise)}</div></div>
          <div class="c"><div class="lbl">${esc(L.daylight)}</div><div class="big">${this._dur(day.len)}</div>${delta}</div>
          <div class="r"><div class="lbl">${esc(L.sunset)}</div><div class="big">${hm(ev.sunset)}</div></div>
        </div>
        <div class="chw main"${sunEntity}>${this._chart(day, nowMin, elev, true)}</div>`;

      if (cfg.sections.stats) {
        const dir = COMPASS[Math.round(az / 22.5) % 16];
        const nextTxt = next ? `${esc(next.label)} ${esc(L.in)} ${this._dur(nextIn)}` : '—';
        html += `<div class="grid">
          <div class="tile"${sunEntity}><div class="k">${esc(L.elevation)}</div><div class="v">${elev.toFixed(1)}°</div><div class="s">${esc(L.peak)} ${ev.peak.toFixed(1)}°</div></div>
          <div class="tile"${sunEntity}><div class="k">${esc(L.azimuth)}</div><div class="v">${Math.round(az)}° ${dir}</div><div class="s">${esc(statusText)}</div></div>
          <div class="tile"><div class="k">${esc(L.next)}</div><div class="v">${next ? hm(next.m) : '—'}</div><div class="s">${nextTxt}</div></div>
        </div>`;
      }

      if (cfg.sections.timeline) {
        html += `<div class="grid tl">${seq.map((x) => {
          const isNext = next && x.k === next.k;
          const sub = x.k === 'noon' ? `${ev.peak.toFixed(1)}°` : x.k === 'golden' ? `→ ${hm(ev.sunset)}` : '';
          return `<div class="tile${isNext ? ' next' : ''}"><div class="k">${esc(x.label)}</div><div class="v">${hm(x.m)}</div>${sub ? `<div class="s">${sub}</div>` : ''}</div>`;
        }).join('')}</div>`;
      }

      if (cfg.sections.tiles && tiles.length) {
        html += `<div class="grid">${tiles.map(({ t, st }) => {
          const label = t.label || (st && st.attributes && st.attributes.friendly_name) || t.entity;
          return `<div class="tile" data-entity="${esc(t.entity)}"><div class="k">${esc(label)}</div><div class="v">${esc(this._fmtState(st))}</div></div>`;
        }).join('')}</div>`;
      }

      if (cfg.sections.arrays && arrs.length) {
        let total = 0;
        let totalPeak = 0;
        let any = false;
        const rows = arrs.map((x) => {
          const a = x.a;
          if (x.w !== null) { total += x.w; any = true; }
          if (a.peak_w) totalPeak += a.peak_w;
          const pct = a.peak_w && x.w !== null ? clamp((x.w / a.peak_w) * 100, 0, 100) : null;
          let sunTxt = '';
          if (a.azimuth !== null) {
            sunTxt = elev <= 0 ? L.night : x.inc > 0.02 ? `${Math.round(x.inc * 100)}% ${L.sun_on_panel}` : L.sun_behind;
          }
          const meta = [sunTxt, x.energy ? `${x.energy} ${L.today}` : ''].filter(Boolean);
          return `<div class="ar" style="--ac:${esc(a.color)}" data-entity="${esc(a.entity)}">
            <div class="n">${esc(a.name || a.entity)}</div><div class="w">${this._fmtW(x.w)}</div>
            ${pct !== null ? `<div class="bar"><i style="width:${pct.toFixed(0)}%"></i></div>` : ''}
            ${meta.length ? `<div class="m">${meta.map((m) => `<span>${esc(m)}</span>`).join('')}</div>` : ''}
          </div>`;
        }).join('');
        html += `<div class="sec">${esc(L.arrays)}</div>`;
        if (arrs.some((x) => x.a.peak_w)) {
          html += `<div class="chw">${this._arrChart(day, nowMin, arrs)}</div><div class="sub" style="text-align:center">${esc(L.potential)}</div>`;
        }
        html += `<div class="arr">${rows}`;
        if (arrs.length > 1) {
          html += `<div class="ar tot" style="--ac:var(--sc-accent)"><div class="n">${esc(L.total)}</div><div class="w">${any ? this._fmtW(total) : '—'}</div>
            ${totalPeak ? `<div class="bar"><i style="width:${any ? clamp((total / totalPeak) * 100, 0, 100).toFixed(0) : 0}%"></i></div>` : ''}</div>`;
        }
        html += '</div>';
      }
      return html;
    }
  }

  customElements.define('sun-day-card', SunDayCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'sun-day-card',
    name: 'Sun Day Card',
    description: 'Sunrise / sunset / dawn / dusk with the sun on an elevation curve; advanced variant adds daylight length, golden hour, live position and solar array potential vs output.',
    preview: false,
  });
  console.info(`%c SUN-DAY-CARD %c v${VERSION} `, 'background:#f9d05c;color:#000', 'background:#222;color:#fff');
})();
