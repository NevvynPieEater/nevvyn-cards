/**
 * Victron ESS Card — a custom Lovelace card for Victron GX / ESS systems.
 *
 * Live animated power-flow (solar / grid / battery / house / optional EV charger),
 * a glowing SOC ring, and controls for ESS mode, MultiPlus mode, max battery
 * charge current and an optional automations on/off toggle.
 *
 * Flow lines are drawn as moving dashes whose speed scales with the power on that
 * branch, and can be rendered as smooth curves or straight angular segments.
 *
 * NOTHING SITE-SPECIFIC IS HARD-CODED IN THIS FILE.
 * Every entity ID, option list, label, preset, slider limit and threshold comes
 * from the card configuration, so the same file can be reused on any site.
 *
 * Install:
 *  1. Copy this file to /config/www/community/victron-card/victron-ess-card.js
 *  2. Settings -> Dashboards -> Resources -> Add Resource
 *       URL: /local/community/victron-card/victron-ess-card.js   Type: JavaScript Module
 *     (append ?v=2, ?v=3 ... to the URL when you replace the file, to bust the cache)
 *  3. Add a card — full example:
 *
 *  type: custom:victron-ess-card
 *  title: Victron ESS
 *  subtitle: MultiPlus-II · ESS            # optional
 *  entities:
 *    # --- required when sections.flow is on (the default) ---
 *    battery_soc: sensor.xxx               # %
 *    battery_power: sensor.xxx             # W, positive = charging
 *    grid_power: sensor.xxx                # W, negative = exporting
 *    solar_power: sensor.xxx               # W
 *    consumption_power: sensor.xxx         # W
 *    # --- optional: each stat tile / pill source only shows if configured ---
 *    battery_voltage: sensor.xxx
 *    battery_current: sensor.xxx
 *    battery_temp: sensor.xxx
 *    battery_soh: sensor.xxx
 *    battery_state: sensor.xxx             # header pill fallback text
 *    input_source: sensor.xxx              # header pill fallback text
 *    # --- optional EV charger (Zappi etc). The node only appears if car_power is set ---
 *    car_power: sensor.xxx                 # W charging power (negative = V2G / reverse)
 *    car_status: sensor.xxx                # small text under the node, e.g. "Paused"
 *    car_plug: sensor.xxx                  # node is dimmed while its state contains "disconnected"
 *    # --- required only if the matching section is on ---
 *    ess_mode: select.xxx                  # sections.ess_mode
 *    multiplus_mode: select.xxx            # sections.multiplus_mode
 *    max_charge_current: number.xxx        # sections.charge_current
 *    automations_enabled: input_boolean.xxx  # sections.automations_toggle (any toggleable domain)
 *  sections:                               # all default to true
 *    header: true                          #   false hides the title bar (badge, title, status pill)
 *    flow: true
 *    car: true                             #   still needs entities.car_power to be shown
 *    stats: true
 *    ess_mode: true
 *    multiplus_mode: true
 *    charge_current: true
 *    automations_toggle: true
 *  style: dark                             # dark (default, the original dark-blue look) | light | lcars
 *                                          #   light follows your HA theme and matches toggle-info-card
 *                                          #   lcars uses the Antonio font if your dashboard loads it
 *                                          #   (the old value "normal" still works and means dark)
 *  line_style: curved                      # curved | angular — shape of the flow lines
 *                                          #   (light style: also tile corners, cut vs rounded)
 *                                          #   default is curved, or angular when style is lcars
 *  house_excludes_car: false               # true = show House as consumption minus car_power. Use it when
 *                                          #   consumption_power already includes the charger (e.g. Zappi on AC-out 2)
 *  flow_animation:                         # optional: how line speed follows power
 *    max_w: 7500                           #   power at which lines reach max_speed
 *    min_speed: 6                          #   slowest moving speed (just above flow_min_w)
 *    max_speed: 80                         #   fastest speed (svg units / second)
 *    curve: sqrt                           #   sqrt (default) | linear | log — how power maps to speed
 *  ess_mode_options: [a, b]                # optional: filter + order of the select's options
 *  ess_mode_labels: { a: "Label A" }       # optional: button text (falls back to prettified option)
 *  multiplus_mode_options: [...]           # optional
 *  multiplus_mode_labels: { ... }          # optional
 *  charge_slider:                          # optional
 *    min: 0                                #   default: entity's min attribute, else 0
 *    max: 70                               #   default: entity's max attribute
 *    max_entity: input_number.xxx          #   overrides max with this entity's state
 *    min_entity: input_number.xxx          #   overrides min with this entity's state
 *    step: 1
 *    presets: [0, 10, 20, 30]              #   preset chips (only those inside min..max are shown)
 *  thresholds:                             # optional (defaults below)
 *    soc_critical: 20                      #   SOC ring turns red below this
 *    soc_warning: 50                       #   ...amber below this, green above
 *    flow_min_w: 5                         #   below this a flow line is idle
 *    charge_state_w: 20                    #   header pill says Charging/Discharging beyond +/- this
 *  labels:                                 # optional UI text overrides (defaults below)
 *    solar: Solar
 *    grid: Grid
 *    battery: Battery
 *    house: House
 *    car: Car
 *    soc: SOC
 *    voltage: Voltage
 *    current: Current
 *    temp: Temp
 *    soh: SOH
 *    ess_mode: "ESS Mode — Battery ⇄ Grid"
 *    multiplus_mode: Inverter / Charger Mode
 *    charge_current: Max Battery Charge Current
 *    automations: null                     #   null = use the toggle entity's friendly name
 *    charging: Charging
 *    discharging: Discharging
 *    idle: Idle
 */

// ---- Neutral fallbacks only. Override any of these from the card config. ----
const DEFAULT_SECTIONS = {
  header: true,
  flow: true,
  car: true,
  stats: true,
  ess_mode: true,
  multiplus_mode: true,
  charge_current: true,
  automations_toggle: true,
};

const DEFAULT_THRESHOLDS = {
  soc_critical: 20,
  soc_warning: 50,
  flow_min_w: 5,
  charge_state_w: 20,
};

const DEFAULT_LABELS = {
  title: 'Victron ESS',
  solar: 'Solar',
  grid: 'Grid',
  battery: 'Battery',
  house: 'House',
  car: 'Car',
  soc: 'SOC',
  voltage: 'Voltage',
  current: 'Current',
  temp: 'Temp',
  soh: 'SOH',
  ess_mode: 'ESS Mode — Battery ⇄ Grid',
  multiplus_mode: 'Inverter / Charger Mode',
  charge_current: 'Max Battery Charge Current',
  automations: null,
  charging: 'Charging',
  discharging: 'Discharging',
  idle: 'Idle',
};

// Flow-line animation: speeds are in svg units per second (the diagram is 360 wide).
const DEFAULT_ANIMATION = { max_w: 7500, min_speed: 6, max_speed: 80, curve: 'sqrt' };
const ANIMATION_CURVES = ['sqrt', 'linear', 'log'];
const LINE_STYLES = ['curved', 'angular'];
const THEMES = ['dark', 'light', 'lcars'];
const DASH_ON = 14;
const DASH_OFF = 10;
const DASH_PERIOD = DASH_ON + DASH_OFF;

// Geometry of each flow branch. Every path is drawn from the outer node towards the hub
// (the car branch runs hub -> car). "forward" below means along that drawing direction.
// Curved paths are the original beziers; angular paths are straight segments with one bend.
const FLOW_PATHS = {
  solar: { curved: 'M70,55 C130,55 150,90 178,105',     angular: 'M70,55 L132,55 L178,105' },
  grid:  { curved: 'M290,55 C230,55 210,90 182,105',    angular: 'M290,55 L228,55 L182,105' },
  batt:  { curved: 'M70,175 C130,175 150,140 178,125',  angular: 'M70,175 L132,175 L178,125' },
  house: { curved: 'M290,175 C230,175 210,140 182,125', angular: 'M290,175 L228,175 L182,125' },
  car:   { curved: 'M180,146 L180,216',                 angular: 'M180,146 L180,216' },
};

// Units used only when the entity does not report its own unit_of_measurement.
const FALLBACK_UNITS = { voltage: 'V', current: 'A', temp: '°C', soh: '%', charge: 'A' };

const ENTITY_RE = /^[a-z0-9_]+\.[a-z0-9_]+$/;
const domainOf = (id) => String(id).split('.')[0];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtW = (w) => `${Math.round(Math.abs(w)).toLocaleString()} W`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prettify = (opt) => {
  const s = String(opt).replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const STYLE = `
:host { display:block; }
ha-card {
  overflow: hidden;
  background: #0b1526;
  color: #eaf2ff;
  border-radius: 18px;
  font-family: var(--paper-font-body1_-_font-family, "Segoe UI", Roboto, sans-serif);
}
.vc-root { position: relative; padding: 0 0 16px 0; }

/* header */
.vc-header {
  display:flex; align-items:center; gap:12px;
  padding: 16px 18px 14px 18px;
  background: linear-gradient(120deg, #062a4d 0%, #0c4a86 45%, #0b3a6b 100%);
  background-size: 220% 220%;
  animation: vcGradient 10s ease infinite;
  position: relative;
}
@keyframes vcGradient {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
.vc-header::after {
  content:""; position:absolute; inset:0;
  background: radial-gradient(circle at 85% -10%, rgba(0,180,255,0.35), transparent 55%);
  pointer-events:none;
}
.vc-badge {
  width:42px; height:42px; flex:0 0 auto; border-radius:12px;
  background: radial-gradient(circle at 30% 30%, #35b6ff, #0071c5 60%, #023e73 100%);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.15) inset, 0 4px 14px rgba(0,120,220,0.55);
  display:flex; align-items:center; justify-content:center;
  z-index:1;
}
.vc-badge svg { width:24px; height:24px; }
.vc-title { flex:1 1 auto; min-width:0; z-index:1; }
.vc-title-main { font-size:16px; font-weight:700; letter-spacing:.2px; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.vc-title-sub { font-size:11px; color:#a9d4ff; opacity:.85; margin-top:1px; text-transform:uppercase; letter-spacing:.08em; }
.vc-source-pill {
  z-index:1; font-size:11px; font-weight:600; padding:5px 10px; border-radius:999px;
  background: rgba(255,255,255,0.12); color:#dff0ff; white-space:nowrap;
  border:1px solid rgba(255,255,255,0.18);
}
.vc-source-pill.charging { background: rgba(46,204,113,0.22); border-color: rgba(46,204,113,0.45); color:#bdf5cf;}
.vc-source-pill.discharging { background: rgba(255,159,28,0.2); border-color: rgba(255,159,28,0.4); color:#ffe3bd; }

/* flow diagram */
.vc-flow-wrap { padding: 14px 10px 4px 10px; }
.vc-flow svg { width:100%; height:auto; display:block; }
.vc-node-icon { fill:#dcecff; }
.vc-node-label { fill:#9db8dd; font-size:9.5px; font-weight:600; letter-spacing:.04em; text-transform:uppercase; }
.vc-node-value { fill:#ffffff; font-size:13px; font-weight:700; }
.vc-node-circle { fill:#122b4d; stroke:rgba(255,255,255,0.08); stroke-width:1; }
.vc-node-sub { fill:#7f9cc4; font-size:8.5px; font-weight:600; letter-spacing:.02em; }
.vc-node.dim { opacity:.45; }
.vc-node { transition: opacity .4s; }

/* flow lines: a faint track with bright dashes moving along it (offset driven from JS) */
.vc-flow-track { fill:none; stroke:rgba(255,255,255,0.10); stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.vc-flow-line {
  fill:none; stroke:#4fd1ff; stroke-width:3; stroke-linecap:round; stroke-linejoin:round;
  opacity:0; transition: opacity .4s;
  filter: drop-shadow(0 0 3px rgba(79,209,255,0.85));
}
.vc-flow-line.on { opacity:1; }
.vc-flow-line.export { stroke:#ff9f1c; filter: drop-shadow(0 0 3px rgba(255,159,28,0.85)); }
.vc-flow-line.solar { stroke:#ffd23f; filter: drop-shadow(0 0 3px rgba(255,210,63,0.85)); }
.vc-flow-line.car { stroke:#3ee08a; filter: drop-shadow(0 0 3px rgba(62,224,138,0.85)); }

/* soc ring lives inside the svg hub, built with a conic-style arc */
.vc-hub-ring-bg { fill:#0b1526; stroke:rgba(255,255,255,0.08); stroke-width:6; }
.vc-hub-ring { fill:none; stroke-linecap:round; transition: stroke-dashoffset .6s ease, stroke .6s ease; }
.vc-hub-pct { fill:#fff; font-size:17px; font-weight:800; }
.vc-hub-sub { fill:#8fb4e0; font-size:8px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; }

/* stat strip */
.vc-stats {
  display:grid; grid-template-columns: repeat(var(--vc-stat-cols, 4), 1fr); gap:8px;
  padding: 4px 14px 2px 14px;
}
.vc-stat {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 10px; padding: 8px 6px; text-align:center;
}
.vc-stat-label { font-size:9.5px; color:#87a6cc; text-transform:uppercase; letter-spacing:.05em; font-weight:700; }
.vc-stat-value { font-size:13.5px; font-weight:700; color:#fff; margin-top:2px; }

/* sections */
.vc-section { padding: 14px 16px 0 16px; }
.vc-section-title { font-size:11.5px; font-weight:700; color:#8fb4e0; text-transform:uppercase; letter-spacing:.06em; margin-bottom:8px; }

.vc-segmented { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; }
.vc-seg-btn {
  flex:0 1 150px; min-width:96px; text-align:center; cursor:pointer; user-select:none;
  padding:8px 6px; border-radius:10px; font-size:12px; font-weight:600;
  background: rgba(255,255,255,0.05); color:#c7dcf7; border:1px solid rgba(255,255,255,0.08);
  transition: background .2s, color .2s, border-color .2s, transform .1s;
}
.vc-seg-btn:active { transform: scale(0.97); }
.vc-seg-btn.active {
  background: linear-gradient(135deg,#0d8bff,#0055b3);
  color:#fff; border-color:transparent;
  box-shadow: 0 3px 10px rgba(13,139,255,0.45);
}

.vc-slider-row { display:flex; align-items:center; gap:12px; }
.vc-slider { flex:1 1 auto; -webkit-appearance:none; appearance:none; height:6px; border-radius:999px;
  background: linear-gradient(90deg, #0d8bff var(--fill,50%), rgba(255,255,255,0.1) var(--fill,50%));
  outline:none;
}
.vc-slider:disabled { opacity:.4; }
.vc-slider::-webkit-slider-thumb {
  -webkit-appearance:none; appearance:none; width:18px; height:18px; border-radius:50%;
  background:#fff; box-shadow:0 0 0 4px rgba(13,139,255,0.35); cursor:pointer;
}
.vc-slider::-moz-range-thumb {
  width:18px; height:18px; border-radius:50%; border:none;
  background:#fff; box-shadow:0 0 0 4px rgba(13,139,255,0.35); cursor:pointer;
}
.vc-slider-value { min-width:56px; text-align:right; font-weight:700; font-size:13px; color:#fff; }

.vc-chip-row { display:flex; gap:6px; flex-wrap:wrap; margin-top:9px; }
.vc-chip {
  padding:5px 10px; border-radius:999px; font-size:11.5px; font-weight:700; cursor:pointer;
  background: rgba(255,255,255,0.05); color:#a9c8ec; border:1px solid rgba(255,255,255,0.08);
}
.vc-chip.active { background: rgba(13,139,255,0.25); color:#fff; border-color: rgba(13,139,255,0.6); }

.vc-footer-toggle {
  display:flex; align-items:center; justify-content:space-between;
  margin: 16px 16px 0 16px; padding: 10px 12px; border-radius: 10px;
  background: rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);
}
.vc-footer-toggle .label { font-size:12.5px; font-weight:600; color:#cfe1f7; }
.vc-switch { width:38px; height:22px; border-radius:999px; background:rgba(255,255,255,0.14); position:relative; cursor:pointer; flex:0 0 auto; transition: background .2s; }
.vc-switch.on { background: linear-gradient(135deg,#0d8bff,#0055b3); }
.vc-switch .knob { position:absolute; top:2px; left:2px; width:18px; height:18px; border-radius:50%; background:#fff; transition: left .2s; box-shadow:0 1px 3px rgba(0,0,0,0.4); }
.vc-switch.on .knob { left:18px; }

/* config / missing-entity notices */
.vc-notice {
  margin: 14px 16px 0 16px; padding: 10px 12px; border-radius: 10px;
  background: rgba(255,91,91,0.12); border:1px solid rgba(255,91,91,0.35);
  color:#ffd3d3; font-size:12px; line-height:1.45;
}
.vc-notice b { color:#fff; }
.vc-notice code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size:11.5px; color:#fff; }
.vc-notice.warn { background: rgba(255,176,32,0.10); border-color: rgba(255,176,32,0.35); color:#ffe3b0; }
`;

// LCARS look, layered on top of STYLE when `style: lcars`. Every rule is scoped to ha-card.lcars,
// so the normal look is untouched. Override the palette from a theme or card-mod via --lc-* vars.
const LCARS_STYLE = `
ha-card.lcars {
  --lc-o:#ff9900; --lc-p:#ffcc99; --lc-v:#cc99cc; --lc-b:#9999ff;
  --lc-t:#ffcc66; --lc-r:#cc6666; --lc-g:#99cc99; --lc-dim:#3d3350;
  background:#000; color:var(--lc-p);
  border-radius:36px 8px 8px 8px;
  font-family: Antonio, Okuda, "Helvetica Neue", Arial, sans-serif;
  letter-spacing:.05em;
}
.lcars .vc-root { padding:0 0 18px 0; }

/* header: orange elbow cap, title, rounded end pill, three-colour bar underneath */
.lcars .vc-header { background:#000; animation:none; padding:0; gap:0; min-height:56px; align-items:stretch; margin-bottom:14px; }
.lcars .vc-header::after {
  inset:auto 0 -7px 0; height:6px;
  background: linear-gradient(90deg, var(--lc-o) 0 86px, #000 86px 92px, var(--lc-v) 92px 55%, #000 55% calc(55% + 6px), var(--lc-b) calc(55% + 6px) 100%);
}
.lcars .vc-badge { width:86px; height:auto; border-radius:36px 0 0 0; background:var(--lc-o); box-shadow:none; margin-right:6px; color:#000; }
.lcars .vc-badge svg g { fill:#000; }
.lcars .vc-title { display:flex; flex-direction:column; justify-content:center; padding:10px 14px; }
.lcars .vc-title-main { color:var(--lc-o); font-size:24px; font-weight:400; letter-spacing:.12em; text-transform:uppercase; }
.lcars .vc-title-sub { color:var(--lc-v); opacity:1; font-size:13px; letter-spacing:.14em; }
.lcars .vc-source-pill {
  align-self:center; margin-right:14px; background:var(--lc-v); color:#000; border:0;
  border-radius:0 20px 20px 0; padding:8px 16px 8px 12px;
  font-size:15px; font-weight:400; letter-spacing:.1em; text-transform:uppercase;
}
.lcars .vc-source-pill.charging { background:var(--lc-g); color:#000; border:0; }
.lcars .vc-source-pill.discharging { background:var(--lc-t); color:#000; border:0; }

/* flow diagram */
.lcars .vc-flow-wrap { padding-top:18px; }
.lcars .vc-flow-track { stroke:#2a2238; stroke-width:3; }
.lcars .vc-flow-line { stroke:var(--lc-o); stroke-width:4; stroke-linecap:butt; filter:none; }
.lcars .vc-flow-line.export { stroke:var(--lc-r); filter:none; }
.lcars .vc-flow-line.solar { stroke:var(--lc-t); filter:none; }
.lcars .vc-flow-line.car { stroke:var(--lc-b); filter:none; }
.lcars .vc-node-circle { fill:#000; stroke:var(--lc-v); stroke-width:3; }
.lcars .vc-node-icon { fill:var(--lc-p); }
.lcars .vc-node-label { fill:var(--lc-v); font-size:11.5px; font-weight:400; letter-spacing:.1em; }
.lcars .vc-node-value { fill:#fff; font-size:15px; font-weight:400; letter-spacing:.04em; }
.lcars .vc-node-sub { fill:var(--lc-p); font-size:10px; font-weight:400; }
.lcars .vc-hub-ring-bg { fill:#000; stroke:var(--lc-dim); stroke-width:7; }
.lcars .vc-hub-ring { stroke-width:7; stroke-linecap:butt; }
.lcars .vc-hub-ring.soc-ok { stroke:var(--lc-g); }
.lcars .vc-hub-ring.soc-warn { stroke:var(--lc-t); }
.lcars .vc-hub-ring.soc-crit { stroke:var(--lc-r); }
.lcars .vc-hub-pct { fill:var(--lc-p); font-size:20px; font-weight:400; }
.lcars .vc-hub-sub { fill:var(--lc-v); font-size:10px; font-weight:400; letter-spacing:.14em; }

/* stat tiles: coloured side bar, one cut corner (same shape language as the toggle info card) */
.lcars .vc-stats { gap:6px; padding:6px 14px 2px 14px; }
.lcars .vc-stat {
  background:#14101c; border:0; border-left:8px solid var(--lc-o); border-radius:0;
  padding:6px 8px; text-align:left;
  clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
}
.lcars .vc-stat:nth-child(2) { border-left-color:var(--lc-v); }
.lcars .vc-stat:nth-child(3) { border-left-color:var(--lc-b); }
.lcars .vc-stat:nth-child(4) { border-left-color:var(--lc-t); }
.lcars .vc-stat-label { color:var(--lc-v); font-size:12px; font-weight:400; letter-spacing:.12em; }
.lcars .vc-stat-value { color:var(--lc-p); font-size:18px; font-weight:400; }

/* section headings and controls */
.lcars .vc-section { padding:18px 14px 0 14px; }
.lcars .vc-section-title { display:flex; align-items:center; gap:10px; color:var(--lc-o); font-size:14px; font-weight:400; letter-spacing:.14em; margin-bottom:10px; }
.lcars .vc-section-title::before { content:""; flex:none; width:46px; height:14px; border-radius:7px 0 0 7px; background:var(--lc-o); }
.lcars .vc-section-title::after { content:""; flex:1; height:4px; background:var(--lc-dim); }

.lcars .vc-segmented { justify-content:flex-start; gap:6px; }
.lcars .vc-seg-btn {
  flex:1 1 110px; background:#000; color:var(--lc-v); border:2px solid var(--lc-v); border-radius:999px;
  padding:8px 6px; font-size:14px; font-weight:400; letter-spacing:.1em; text-transform:uppercase; box-shadow:none;
}
.lcars .vc-seg-btn.active { background:var(--lc-o); border-color:var(--lc-o); color:#000; box-shadow:none; }

.lcars .vc-slider { height:10px; border-radius:0; background:linear-gradient(90deg, var(--lc-o) var(--fill,50%), var(--lc-dim) var(--fill,50%)); }
.lcars .vc-slider::-webkit-slider-thumb { width:16px; height:28px; border-radius:8px; background:var(--lc-p); box-shadow:none; }
.lcars .vc-slider::-moz-range-thumb { width:16px; height:28px; border-radius:8px; background:var(--lc-p); box-shadow:none; }
.lcars .vc-slider-value { color:var(--lc-p); font-size:18px; font-weight:400; }

.lcars .vc-chip { background:#000; border:2px solid var(--lc-b); color:var(--lc-b); border-radius:999px; font-size:13px; font-weight:400; letter-spacing:.08em; }
.lcars .vc-chip.active { background:var(--lc-b); border-color:var(--lc-b); color:#000; }

.lcars .vc-footer-toggle {
  background:#14101c; border:0; border-left:8px solid var(--lc-v); border-radius:0;
  margin:20px 14px 0 14px; padding:8px 12px;
  clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
}
.lcars .vc-footer-toggle .label { color:var(--lc-p); font-size:15px; font-weight:400; letter-spacing:.1em; text-transform:uppercase; }
.lcars .vc-switch { width:64px; height:28px; border-radius:14px; background:var(--lc-dim); display:grid; place-items:center; }
.lcars .vc-switch::after { content:"OFF"; color:var(--lc-p); font-size:13px; letter-spacing:.1em; }
.lcars .vc-switch.on { background:var(--lc-o); }
.lcars .vc-switch.on::after { content:"ON"; color:#000; }
.lcars .vc-switch .knob { display:none; }

.lcars .vc-notice { border-radius:0; letter-spacing:.02em; }
`;

// Light look, layered on top of STYLE when `style: light`. It uses your HA theme variables and the same
// shapes as toggle-info-card's light style: tinted rows, a coloured side bar, cut corners (line_style:
// angular) or rounded corners (line_style: curved). With a dark HA theme it follows the theme.
const LIGHT_CUT = 'polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))';
const LIGHT_STYLE = `
ha-card.light {
  --vc-accent: var(--primary-color, #03a9f4);
  --vc-surface: var(--secondary-background-color, rgba(127,127,127,.12));
  --vc-off: var(--disabled-text-color, #9e9e9e);
  --vc-line: var(--divider-color, rgba(127,127,127,.3));
  --vc-ok: var(--success-color, #43a047);
  --vc-warn: var(--warning-color, #ffa000);
  --vc-bad: var(--error-color, #e53935);
  background: var(--ha-card-background, var(--card-background-color, #fff));
  color: var(--primary-text-color);
  border-radius: var(--ha-card-border-radius, 12px);
  font-family: var(--ha-font-family-body, var(--paper-font-body1_-_font-family, Roboto, sans-serif));
}
.light .vc-root { padding:12px; }

/* header */
.light .vc-header { background:none; animation:none; padding:4px 4px 10px 4px; gap:12px; }
.light .vc-header::after { display:none; }
.light .vc-badge { width:38px; height:38px; border-radius:10px; background:var(--vc-accent); box-shadow:none; }
.light .vc-title-main { color:var(--primary-text-color); font-size:1.15rem; font-weight:600; letter-spacing:0; }
.light .vc-title-sub { color:var(--secondary-text-color); opacity:1; font-size:.85rem; text-transform:none; letter-spacing:0; }
.light .vc-source-pill { background:var(--vc-surface); color:var(--secondary-text-color); border:0; font-weight:500; }
.light .vc-source-pill.charging { background:color-mix(in srgb, var(--vc-ok) 22%, transparent); color:var(--primary-text-color); border:0; }
.light .vc-source-pill.discharging { background:color-mix(in srgb, var(--vc-warn) 25%, transparent); color:var(--primary-text-color); border:0; }

/* flow diagram */
.light .vc-flow-wrap { padding:6px 0 4px 0; }
.light .vc-flow-track { stroke:var(--vc-line); }
.light .vc-flow-line { stroke:var(--vc-accent); filter:none; }
.light .vc-flow-line.export { stroke:#fb8c00; filter:none; }
.light .vc-flow-line.solar { stroke:#ffb300; filter:none; }
.light .vc-flow-line.car { stroke:var(--vc-ok); filter:none; }
.light .vc-node-circle { fill:var(--vc-surface); stroke:var(--vc-line); }
.light .vc-node-icon { fill:var(--primary-text-color); }
.light .vc-node-label { fill:var(--secondary-text-color); }
.light .vc-node-value { fill:var(--primary-text-color); }
.light .vc-node-sub { fill:var(--secondary-text-color); }
.light .vc-hub-ring-bg { fill:var(--ha-card-background, var(--card-background-color, #fff)); stroke:var(--vc-surface); }
.light .vc-hub-ring.soc-ok { stroke:var(--vc-ok); }
.light .vc-hub-ring.soc-warn { stroke:var(--vc-warn); }
.light .vc-hub-ring.soc-crit { stroke:var(--vc-bad); }
.light .vc-hub-pct { fill:var(--primary-text-color); }
.light .vc-hub-sub { fill:var(--secondary-text-color); }

/* stat tiles, mode buttons and the automations row share the toggle card's row look */
.light .vc-stats { gap:6px; padding:4px 0 2px 0; }
.light .vc-stat {
  background:var(--vc-surface); border:0; border-left:6px solid var(--vc-accent); border-radius:0;
  padding:8px 6px 8px 10px; text-align:left;
}
.light .vc-stat-label { color:var(--secondary-text-color); font-size:.72rem; }
.light .vc-stat-value { color:var(--primary-text-color); font-size:1rem; font-weight:600; }

.light .vc-section { padding:16px 0 0 0; }
.light .vc-section-title { color:var(--secondary-text-color); font-size:.75rem; font-weight:500; letter-spacing:.08em; }
.light .vc-segmented { justify-content:stretch; }
.light .vc-seg-btn {
  flex:1 1 140px; background:var(--vc-surface); color:var(--primary-text-color);
  border:0; border-left:6px solid var(--vc-off); border-radius:0; padding:12px 8px; font-weight:500; box-shadow:none;
}
.light .vc-seg-btn.active {
  background:color-mix(in srgb, var(--vc-accent) 14%, var(--vc-surface));
  border-left-color:var(--vc-accent); color:var(--primary-text-color); box-shadow:none;
}

.light .vc-slider { background:linear-gradient(90deg, var(--vc-accent) var(--fill,50%), var(--vc-line) var(--fill,50%)); }
.light .vc-slider::-webkit-slider-thumb { background:var(--vc-accent); box-shadow:0 0 0 4px color-mix(in srgb, var(--vc-accent) 30%, transparent); }
.light .vc-slider::-moz-range-thumb { background:var(--vc-accent); box-shadow:0 0 0 4px color-mix(in srgb, var(--vc-accent) 30%, transparent); }
.light .vc-slider-value { color:var(--primary-text-color); }
.light .vc-chip { background:transparent; color:var(--secondary-text-color); border:1px solid var(--vc-line); }
.light .vc-chip.active { background:color-mix(in srgb, var(--vc-accent) 14%, transparent); color:var(--primary-text-color); border-color:var(--vc-accent); }

.light .vc-footer-toggle {
  background:var(--vc-surface); border:0; border-left:6px solid var(--vc-off); border-radius:0;
  margin:16px 0 0 0; padding:10px 10px 10px 12px;
}
.light .vc-footer-toggle.on { border-left-color:var(--vc-accent); background:color-mix(in srgb, var(--vc-accent) 14%, var(--vc-surface)); }
.light .vc-footer-toggle .label { color:var(--primary-text-color); font-size:.95rem; font-weight:500; }
.light .vc-switch { background:color-mix(in srgb, var(--vc-off) 60%, transparent); }
.light .vc-switch.on { background:var(--vc-accent); }

.light .vc-notice { margin:14px 0 0 0; background:color-mix(in srgb, var(--vc-bad) 12%, transparent); border-color:color-mix(in srgb, var(--vc-bad) 40%, transparent); color:var(--primary-text-color); }
.light .vc-notice.warn { background:color-mix(in srgb, var(--vc-warn) 14%, transparent); border-color:color-mix(in srgb, var(--vc-warn) 45%, transparent); color:var(--primary-text-color); }
.light .vc-notice b, .light .vc-notice code { color:inherit; }

/* corner shape follows line_style: angular = cut corners, curved = rounded */
${['.vc-stat', '.vc-footer-toggle', '.vc-seg-btn']
  .map((s) => `ha-card.light.ls-angular ${s} { clip-path:${LIGHT_CUT}; }\nha-card.light.ls-curved ${s} { border-radius:12px; }`)
  .join('\n')}
`;

function svgIcon(name) {
  switch (name) {
    case 'sun':
      return `<circle cx="0" cy="0" r="6"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <line x1="0" y1="-11" x2="0" y2="-9"/><line x1="0" y1="9" x2="0" y2="11"/>
        <line x1="-11" y1="0" x2="-9" y2="0"/><line x1="9" y1="0" x2="11" y2="0"/>
        <line x1="-7.8" y1="-7.8" x2="-6.4" y2="-6.4"/><line x1="6.4" y1="6.4" x2="7.8" y2="7.8"/>
        <line x1="-7.8" y1="7.8" x2="-6.4" y2="6.4"/><line x1="6.4" y1="-6.4" x2="7.8" y2="-7.8"/>
      </g>`;
    case 'grid':
      return `<path d="M0,-11 L-7,4 L-1,4 L-3,11 L8,-2 L1,-2 Z"/>`;
    case 'battery':
      return `<rect x="-8" y="-11" width="16" height="22" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <rect x="-3" y="-14" width="6" height="3" rx="1"/>
        <rect x="-5" y="2" width="10" height="6" rx="1"/>`;
    case 'house':
      return `<path d="M-10,2 L0,-10 L10,2 L10,11 L-10,11 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`;
    case 'car':
      return `<path d="M-11,6 L-11,1 L-8,-3 Q-7,-6 -3,-6 L4,-6 Q7,-6 9,-2 L11,1 L11,6 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="-5.5" cy="6.5" r="2.4"/><circle cx="6" cy="6.5" r="2.4"/>`;
    default:
      return '';
  }
}

class VictronEssCard extends HTMLElement {
  constructor() {
    super();
    this._flows = {};
    this._tick = this._tick.bind(this);
  }

  connectedCallback() { this._startAnim(); }
  disconnectedCallback() { this._stopAnim(); }

  static getStubConfig() {
    // Deliberately no entity IDs: the card lists what is missing until you fill them in.
    return {
      title: 'Victron ESS',
      entities: {
        battery_soc: '',
        battery_power: '',
        grid_power: '',
        solar_power: '',
        consumption_power: '',
      },
      sections: { ...DEFAULT_SECTIONS },
    };
  }

  setConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('victron-ess-card: invalid configuration');
    const entities = config.entities || {};
    if (typeof entities !== 'object' || Array.isArray(entities)) {
      throw new Error('victron-ess-card: "entities" must be a map of key: entity_id');
    }
    for (const [k, v] of Object.entries(entities)) {
      if (v && !ENTITY_RE.test(v)) throw new Error(`victron-ess-card: entities.${k} "${v}" is not a valid entity_id`);
    }

    this._config = config;
    this._entities = entities;
    this._sections = Object.assign({}, DEFAULT_SECTIONS, config.sections || {});
    this._labels = Object.assign({}, DEFAULT_LABELS, config.labels || {});
    this._th = Object.assign({}, DEFAULT_THRESHOLDS, config.thresholds || {});
    this._essFilter = Array.isArray(config.ess_mode_options) ? config.ess_mode_options : null;
    this._mpFilter = Array.isArray(config.multiplus_mode_options) ? config.multiplus_mode_options : null;
    this._essLabels = config.ess_mode_labels || {};
    this._mpLabels = config.multiplus_mode_labels || {};
    this._slider = config.charge_slider || {};
    this._extra = [];
    if (config.extra_sliders !== undefined) {
      if (!Array.isArray(config.extra_sliders)) throw new Error('victron-ess-card: "extra_sliders" must be a list');
      config.extra_sliders.forEach((x, i) => {
        if (!x || typeof x.entity !== 'string' || !ENTITY_RE.test(x.entity)) {
          throw new Error(`victron-ess-card: extra_sliders[${i}].entity must be a valid entity_id`);
        }
        const dom = x.entity.split('.')[0];
        if (!['input_number', 'number'].includes(dom)) {
          throw new Error(`victron-ess-card: extra_sliders[${i}].entity must be an input_number or number (got ${dom})`);
        }
      });
      this._extra = config.extra_sliders;
    }

    const rawTheme = config.style === undefined ? 'dark' : config.style;
    const theme = rawTheme === 'normal' ? 'dark' : rawTheme; // "normal" was the original dark look
    if (!THEMES.includes(theme)) {
      throw new Error(`victron-ess-card: style must be one of ${THEMES.join(', ')} (got "${rawTheme}")`);
    }
    this._theme = theme;

    const style = config.line_style === undefined ? (theme === 'lcars' ? 'angular' : 'curved') : config.line_style;
    if (!LINE_STYLES.includes(style)) {
      throw new Error(`victron-ess-card: line_style must be one of ${LINE_STYLES.join(', ')} (got "${style}")`);
    }
    this._lineStyle = style;

    const anim = Object.assign({}, DEFAULT_ANIMATION, config.flow_animation || {});
    for (const k of ['max_w', 'min_speed', 'max_speed']) {
      anim[k] = Number(anim[k]);
      if (!Number.isFinite(anim[k]) || anim[k] < 0) throw new Error(`victron-ess-card: flow_animation.${k} must be a number >= 0`);
    }
    if (!(anim.max_w > 0)) throw new Error('victron-ess-card: flow_animation.max_w must be greater than 0');
    if (!ANIMATION_CURVES.includes(anim.curve)) {
      throw new Error(`victron-ess-card: flow_animation.curve must be one of ${ANIMATION_CURVES.join(', ')}`);
    }
    this._anim = anim;

    this._hasCar = !!(this._sections.flow && this._sections.car && entities.car_power);
    this._missingConfig = this._validate();

    this._flows = {};
    this._dragging = false;
    this._segSig = {};
    this._chipSig = null;
    this._xDrag = {};
    this._xSig = {};

    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    const themeCss = this._theme === 'lcars' ? LCARS_STYLE : this._theme === 'light' ? LIGHT_STYLE : '';
    this.shadowRoot.innerHTML = `<style>${STYLE}${themeCss}</style><ha-card class="${this._theme} ls-${this._lineStyle}"><div class="vc-root"></div></ha-card>`;
    this._root = this.shadowRoot.querySelector('.vc-root');
    this._built = false;
    this._maybeRender();
  }

  set hass(hass) {
    this._hass = hass;
    this._maybeRender();
  }

  getCardSize() { return this._hasCar ? 10 : 8; }

  // ---- config validation -------------------------------------------------
  _validate() {
    const s = this._sections;
    const need = [];
    if (s.flow) need.push('battery_soc', 'battery_power', 'grid_power', 'solar_power', 'consumption_power');
    if (s.ess_mode) need.push('ess_mode');
    if (s.multiplus_mode) need.push('multiplus_mode');
    if (s.charge_current) need.push('max_charge_current');
    if (s.automations_toggle) need.push('automations_enabled');
    return need.filter((k) => !this._entities[k]);
  }

  // ---- hass helpers ------------------------------------------------------
  _st(id) { return id && this._hass ? this._hass.states[id] : undefined; }
  _state(id, fallback = '') { const s = this._st(id); return s ? s.state : fallback; }
  _num(id, fallback = 0) { const v = parseFloat(this._state(id, fallback)); return Number.isFinite(v) ? v : fallback; }
  _attr(id, key, fallback) { const s = this._st(id); return s && s.attributes && key in s.attributes ? s.attributes[key] : fallback; }
  _call(domain, service, data) { if (this._hass) this._hass.callService(domain, service, data); }

  _maybeRender() {
    if (!this._hass || !this._root) return;
    if (!this._built) {
      this._buildStatic();
      this._built = true;
    }
    if (!this._missingConfig.length) this._updateDynamic();
  }

  // ---- static DOM --------------------------------------------------------
  _buildStatic() {
    const e = this._entities;
    const L = this._labels;
    const title = this._config.title || L.title;
    const subtitle = this._config.subtitle;
    const showPill = !!(e.battery_power || e.input_source || e.battery_state);

    const statDefs = this._statDefs();
    const showStats = this._sections.stats && statDefs.length > 0;

    const missingNotice = this._missingConfig.length
      ? `<div class="vc-notice"><b>victron-ess-card is not configured.</b><br>Missing in <code>entities:</code> — ${this._missingConfig.map((k) => `<code>${esc(k)}</code>`).join(', ')}</div>`
      : '';

    this._root.innerHTML = `
      ${this._sections.header ? `<div class="vc-header">
        <div class="vc-badge">
          <svg viewBox="-12 -12 24 24"><g fill="#fff">${svgIcon('battery')}</g></svg>
        </div>
        <div class="vc-title">
          <div class="vc-title-main">${esc(title)}</div>
          ${subtitle ? `<div class="vc-title-sub">${esc(subtitle)}</div>` : ''}
        </div>
        ${showPill ? '<div class="vc-source-pill" id="sourcePill">—</div>' : ''}
      </div>` : ''}

      ${missingNotice}
      ${this._missingConfig.length ? '' : this._sectionsHtml(statDefs, showStats)}
      <div id="warnHost"></div>
    `;

    if (this._missingConfig.length) return;

    this._statDefsActive = showStats ? statDefs : [];

    // flow lines: one animated overlay per branch (see _tick)
    this._flows = {};
    this._flowKeys().forEach((k) => {
      const el = this._root.querySelector(`#f-${k}`);
      if (el) this._flows[k] = { el, dir: 1, speed: 0, target: 0, offset: 0, cls: '' };
    });

    // charge current slider
    if (this._sections.charge_current) {
      const slider = this._root.querySelector('#chargeSlider');
      slider.step = this._slider.step || 1;
      slider.addEventListener('input', () => {
        this._dragging = true;
        this._paintSlider(parseFloat(slider.value));
        this._syncChargeChips(parseFloat(slider.value));
      });
      slider.addEventListener('change', () => {
        this._call(domainOf(e.max_charge_current), 'set_value', { entity_id: e.max_charge_current, value: parseFloat(slider.value) });
        this._dragging = false;
      });
    }

    // extra sliders (any input_number / number, e.g. the overnight charge target)
    this._extra.forEach((x, i) => {
      const slider = this._root.querySelector(`#xSlider${i}`);
      if (!slider) return;
      slider.step = x.step || 1;
      slider.addEventListener('input', () => {
        this._xDrag[i] = true;
        this._paintExtra(i, parseFloat(slider.value));
      });
      slider.addEventListener('change', () => {
        this._call(domainOf(x.entity), 'set_value', { entity_id: x.entity, value: parseFloat(slider.value) });
        this._xDrag[i] = false;
      });
    });

    if (this._sections.automations_toggle && e.automations_enabled) {
      const sw = this._root.querySelector('#autoSwitch');
      sw.addEventListener('click', () => {
        const on = this._state(e.automations_enabled, 'off') === 'on';
        this._call(domainOf(e.automations_enabled), on ? 'turn_off' : 'turn_on', { entity_id: e.automations_enabled });
      });
    }
  }

  _statDefs() {
    const e = this._entities;
    const L = this._labels;
    return [
      { key: 'battery_voltage', label: L.voltage, unit: FALLBACK_UNITS.voltage, dp: 1 },
      { key: 'battery_current', label: L.current, unit: FALLBACK_UNITS.current, dp: 1 },
      { key: 'battery_temp', label: L.temp, unit: FALLBACK_UNITS.temp, dp: 1 },
      { key: 'battery_soh', label: L.soh, unit: FALLBACK_UNITS.soh, dp: 0 },
    ].filter((d) => e[d.key]);
  }

  _sectionsHtml(statDefs, showStats) {
    const s = this._sections;
    const e = this._entities;
    const L = this._labels;
    return `
      ${s.flow ? `
      <div class="vc-flow-wrap vc-flow">
        <svg viewBox="0 0 360 ${this._hasCar ? 278 : 230}">
          ${this._flowKeys().map((k) => `<path class="vc-flow-track" d="${FLOW_PATHS[k][this._lineStyle]}"/>`).join('')}
          ${this._flowKeys().map((k) => `<path id="f-${k}" class="vc-flow-line" d="${FLOW_PATHS[k][this._lineStyle]}" stroke-dasharray="${DASH_ON} ${DASH_OFF}"/>`).join('')}

          <g transform="translate(70,55)">
            <circle class="vc-node-circle" r="26"/>
            <g class="vc-node-icon" transform="translate(0,-4)">${svgIcon('sun')}</g>
            <text class="vc-node-value" id="val-solar" text-anchor="middle" y="20">0 W</text>
            <text class="vc-node-label" text-anchor="middle" y="42">${esc(L.solar)}</text>
          </g>
          <g transform="translate(290,55)">
            <circle class="vc-node-circle" r="26"/>
            <g class="vc-node-icon" transform="translate(0,-4)">${svgIcon('grid')}</g>
            <text class="vc-node-value" id="val-grid" text-anchor="middle" y="20">0 W</text>
            <text class="vc-node-label" text-anchor="middle" y="42">${esc(L.grid)}</text>
          </g>
          <g transform="translate(70,175)">
            <circle class="vc-node-circle" r="26"/>
            <g class="vc-node-icon" transform="translate(0,-4)">${svgIcon('battery')}</g>
            <text class="vc-node-value" id="val-batt" text-anchor="middle" y="20">0 W</text>
            <text class="vc-node-label" text-anchor="middle" y="42">${esc(L.battery)}</text>
          </g>
          <g transform="translate(290,175)">
            <circle class="vc-node-circle" r="26"/>
            <g class="vc-node-icon" transform="translate(0,-4)">${svgIcon('house')}</g>
            <text class="vc-node-value" id="val-house" text-anchor="middle" y="20">0 W</text>
            <text class="vc-node-label" text-anchor="middle" y="42">${esc(L.house)}</text>
          </g>

          <g transform="translate(180,115)">
            <circle class="vc-hub-ring-bg" r="30"/>
            <circle class="vc-hub-ring" id="hubRing" r="30" stroke="#4fd1ff" stroke-width="6"
                    stroke-dasharray="188.5" stroke-dashoffset="188.5" transform="rotate(-90)"/>
            <text class="vc-hub-pct" id="hubPct" text-anchor="middle" y="5">0%</text>
            <text class="vc-hub-sub" id="hubSub" text-anchor="middle" y="18">${esc(L.soc)}</text>
          </g>

          ${this._hasCar ? `
          <g class="vc-node" id="node-car" transform="translate(180,216)">
            <circle class="vc-node-circle" r="26"/>
            <g class="vc-node-icon" transform="translate(0,-4)">${svgIcon('car')}</g>
            <text class="vc-node-value" id="val-car" text-anchor="middle" y="20">0 W</text>
            <text class="vc-node-label" text-anchor="middle" y="42">${esc(L.car)}</text>
            ${e.car_status ? '<text class="vc-node-sub" id="sub-car" text-anchor="middle" y="54"></text>' : ''}
          </g>` : ''}
        </svg>
      </div>` : ''}

      ${showStats ? `
      <div class="vc-stats" style="--vc-stat-cols:${statDefs.length}">
        ${statDefs.map((d) => `<div class="vc-stat"><div class="vc-stat-label">${esc(d.label)}</div><div class="vc-stat-value" id="stat-${d.key}">—</div></div>`).join('')}
      </div>` : ''}

      ${s.ess_mode ? `
      <div class="vc-section">
        <div class="vc-section-title">${esc(L.ess_mode)}</div>
        <div class="vc-segmented" id="essSeg"></div>
      </div>` : ''}

      ${s.multiplus_mode ? `
      <div class="vc-section">
        <div class="vc-section-title">${esc(L.multiplus_mode)}</div>
        <div class="vc-segmented" id="mpSeg"></div>
      </div>` : ''}

      ${s.charge_current ? `
      <div class="vc-section">
        <div class="vc-section-title">${esc(L.charge_current)}</div>
        <div class="vc-slider-row">
          <input type="range" class="vc-slider" id="chargeSlider">
          <div class="vc-slider-value" id="chargeVal">—</div>
        </div>
        <div class="vc-chip-row" id="chargeChips"></div>
      </div>` : ''}

      ${this._extra.map((x, i) => `
      <div class="vc-section">
        <div class="vc-section-title">${esc(x.label || prettify((x.entity || '').split('.')[1] || ''))}</div>
        <div class="vc-slider-row">
          <input type="range" class="vc-slider" id="xSlider${i}">
          <div class="vc-slider-value" id="xVal${i}">—</div>
        </div>
        <div class="vc-chip-row" id="xChips${i}"></div>
      </div>`).join('')}

      ${s.automations_toggle && e.automations_enabled ? `
      <div class="vc-footer-toggle">
        <div class="label" id="autoLabel"></div>
        <div class="vc-switch" id="autoSwitch"><div class="knob"></div></div>
      </div>` : ''}
    `;
  }

  // ---- option segments (rebuilt whenever the entity's option list changes) ----
  _syncSegments(kind) {
    const isEss = kind === 'ess';
    const entity = isEss ? this._entities.ess_mode : this._entities.multiplus_mode;
    const filter = isEss ? this._essFilter : this._mpFilter;
    const labels = isEss ? this._essLabels : this._mpLabels;
    const host = this._root.querySelector(isEss ? '#essSeg' : '#mpSeg');
    if (!host) return;

    let options = this._attr(entity, 'options', []);
    if (!Array.isArray(options)) options = [];
    if (filter) options = filter.filter((o) => options.includes(o));

    const sig = options.join('|');
    if (this._segSig[kind] === sig) return;
    this._segSig[kind] = sig;

    host.innerHTML = '';
    options.forEach((opt) => {
      const btn = document.createElement('div');
      btn.className = 'vc-seg-btn';
      btn.dataset.opt = opt;
      btn.textContent = labels[opt] || prettify(opt);
      btn.addEventListener('click', () => this._call(domainOf(entity), 'select_option', { entity_id: entity, option: opt }));
      host.appendChild(btn);
    });
  }

  // ---- charge slider -----------------------------------------------------
  _sliderLimits() {
    const id = this._entities.max_charge_current;
    const cfg = this._slider;
    const fromEntity = (eid) => {
      if (!eid) return NaN;
      const n = parseFloat(this._state(eid, ''));
      return Number.isFinite(n) ? n : NaN;
    };
    const firstFinite = (...vals) => vals.map(Number).find((n, i) => vals[i] !== undefined && vals[i] !== null && vals[i] !== '' && Number.isFinite(n));

    const min = firstFinite(fromEntity(cfg.min_entity), cfg.min, this._attr(id, 'min', undefined), 0);
    const max = firstFinite(fromEntity(cfg.max_entity), cfg.max, this._attr(id, 'max', undefined));
    return { min, max };
  }

  _paintSlider(val) {
    const slider = this._root.querySelector('#chargeSlider');
    const min = parseFloat(slider.min), max = parseFloat(slider.max);
    const pct = ((val - min) / (max - min || 1)) * 100;
    slider.style.setProperty('--fill', `${clamp(pct, 0, 100)}%`);
    this._root.querySelector('#chargeVal').textContent = `${val} ${this._chargeUnit()}`;
  }

  _chargeUnit() {
    return this._attr(this._entities.max_charge_current, 'unit_of_measurement', FALLBACK_UNITS.charge);
  }

  _syncChargeChips(val) {
    this._root.querySelectorAll('#chargeChips .vc-chip').forEach((c) => {
      c.classList.toggle('active', parseFloat(c.dataset.val) === val);
    });
  }

  _syncSliderRange(min, max) {
    const slider = this._root.querySelector('#chargeSlider');
    const ok = Number.isFinite(max) && max > min;
    slider.disabled = !ok;
    if (!ok) return false;
    slider.min = min;
    slider.max = max;

    const presets = Array.isArray(this._slider.presets) ? this._slider.presets : [];
    const sig = `${min}|${max}|${presets.join(',')}|${this._chargeUnit()}`;
    if (this._chipSig !== sig) {
      this._chipSig = sig;
      const chipRow = this._root.querySelector('#chargeChips');
      chipRow.innerHTML = '';
      const unit = this._chargeUnit();
      presets.filter((v) => v >= min && v <= max).forEach((v) => {
        const chip = document.createElement('div');
        chip.className = 'vc-chip';
        chip.dataset.val = v;
        chip.textContent = `${v} ${unit}`;
        chip.addEventListener('click', () => {
          this._call(domainOf(this._entities.max_charge_current), 'set_value', { entity_id: this._entities.max_charge_current, value: v });
        });
        chipRow.appendChild(chip);
      });
    }
    return true;
  }

  // ---- extra sliders -----------------------------------------------------
  _extraUnit(i) {
    const x = this._extra[i];
    return x.unit !== undefined ? x.unit : this._attr(x.entity, 'unit_of_measurement', '');
  }

  _paintExtra(i, val) {
    const slider = this._root.querySelector(`#xSlider${i}`);
    if (!slider) return;
    const min = parseFloat(slider.min), max = parseFloat(slider.max);
    const pct = ((val - min) / (max - min || 1)) * 100;
    slider.style.setProperty('--fill', `${clamp(pct, 0, 100)}%`);
    const unit = this._extraUnit(i);
    this._root.querySelector(`#xVal${i}`).textContent = `${val}${unit ? ' ' + unit : ''}`;
    this._root.querySelectorAll(`#xChips${i} .vc-chip`).forEach((c) => {
      c.classList.toggle('active', parseFloat(c.dataset.val) === val);
    });
  }

  _updateExtra() {
    this._extra.forEach((x, i) => {
      const slider = this._root.querySelector(`#xSlider${i}`);
      if (!slider || this._xDrag[i]) return;
      const num = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));
      const pick = (...v) => v.map(num).find((n) => Number.isFinite(n));
      const min = pick(x.min, this._attr(x.entity, 'min', undefined), 0);
      const max = pick(x.max, this._attr(x.entity, 'max', undefined));
      const ok = Number.isFinite(max) && max > min && !!this._st(x.entity);
      slider.disabled = !ok;
      if (!ok) { this._root.querySelector(`#xVal${i}`).textContent = '—'; return; }
      slider.min = min;
      slider.max = max;
      const presets = Array.isArray(x.presets) ? x.presets : [];
      const unit = this._extraUnit(i);
      const sig = `${min}|${max}|${presets.join(',')}|${unit}`;
      if (this._xSig[i] !== sig) {
        this._xSig[i] = sig;
        const row = this._root.querySelector(`#xChips${i}`);
        row.innerHTML = '';
        presets.filter((v) => v >= min && v <= max).forEach((v) => {
          const chip = document.createElement('div');
          chip.className = 'vc-chip';
          chip.dataset.val = v;
          chip.textContent = `${v}${unit ? ' ' + unit : ''}`;
          chip.addEventListener('click', () => this._call(domainOf(x.entity), 'set_value', { entity_id: x.entity, value: v }));
          row.appendChild(chip);
        });
      }
      const val = this._num(x.entity, min);
      slider.value = val;
      this._paintExtra(i, val);
    });
  }

  // ---- animated flow lines -----------------------------------------------
  _flowKeys() {
    return this._hasCar ? ['solar', 'grid', 'batt', 'house', 'car'] : ['solar', 'grid', 'batt', 'house'];
  }

  // Speed (svg units / second) for a branch carrying `w` watts. One global scale for every
  // branch, so a faster line always means more power than a slower one anywhere on the card.
  _speedFor(w) {
    const { max_w, min_speed, max_speed, curve } = this._anim;
    const frac = clamp(Math.abs(w) / max_w, 0, 1);
    const shaped = curve === 'linear' ? frac
      : curve === 'log' ? Math.log10(1 + 99 * frac) / 2
      : Math.sqrt(frac);
    return min_speed + (max_speed - min_speed) * shaped;
  }

  // Sets what a branch should be doing; the rAF loop eases towards it.
  //   dir: +1 moves along the path as drawn, -1 against it.   cls: colour class.
  _setFlow(key, watts, dir, cls) {
    const f = this._flows[key];
    if (!f) return;
    const active = Math.abs(watts) > this._th.flow_min_w;
    if (f.dir !== dir) { f.dir = dir; f.speed = 0; } // new direction eases in from standstill
    f.target = active ? this._speedFor(watts) : 0;
    const klass = `vc-flow-line ${cls}${active ? ' on' : ''}`.replace(/\s+/g, ' ').trim();
    if (f.cls !== klass) { f.cls = klass; f.el.setAttribute('class', klass); }
  }

  _startAnim() {
    if (this._raf || this._reducedMotion()) return;
    this._lastT = null;
    this._raf = requestAnimationFrame(this._tick);
  }

  _stopAnim() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
  }

  _reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
    catch (_) { return false; }
  }

  // One frame: ease each line's speed towards its target and advance its dash offset.
  // Driving the offset from JS (rather than a CSS animation) lets the speed change smoothly
  // as the power changes, with no jump in the dash pattern.
  _tick(t) {
    this._raf = requestAnimationFrame(this._tick);
    const last = this._lastT == null ? t : this._lastT;
    this._lastT = t;
    const dt = Math.min(0.1, Math.max(0, (t - last) / 1000));
    const ease = 1 - Math.exp(-dt * 5);
    for (const f of Object.values(this._flows)) {
      f.speed += (f.target - f.speed) * ease;
      if (f.target === 0 && f.speed < 0.05) { f.speed = 0; continue; }
      f.offset = (f.offset + f.dir * f.speed * dt) % DASH_PERIOD;
      f.el.setAttribute('stroke-dashoffset', (-f.offset).toFixed(2));
    }
  }

  // ---- live updates ------------------------------------------------------
  _updateDynamic() {
    const e = this._entities;
    const L = this._labels;
    const th = this._th;
    const root = this._root;

    // header source pill
    const pill = root.querySelector('#sourcePill');
    if (pill) {
      const battPower = e.battery_power ? this._num(e.battery_power, 0) : 0;
      const charging = !!e.battery_power && battPower > th.charge_state_w;
      const discharging = !!e.battery_power && battPower < -th.charge_state_w;
      const fallback = (e.input_source && this._state(e.input_source)) || (e.battery_state && this._state(e.battery_state)) || L.idle;
      pill.textContent = charging ? L.charging : discharging ? L.discharging : fallback;
      pill.className = 'vc-source-pill' + (charging ? ' charging' : discharging ? ' discharging' : '');
    }

    if (this._sections.flow) {
      const soc = this._num(e.battery_soc, 0);
      const battPower = this._num(e.battery_power, 0);
      const gridPower = this._num(e.grid_power, 0);
      const solarPower = this._num(e.solar_power, 0);
      const carPower = this._hasCar ? this._num(e.car_power, 0) : 0;
      let housePower = this._num(e.consumption_power, 0);
      if (this._config.house_excludes_car && this._hasCar) housePower = Math.max(0, housePower - Math.max(0, carPower));

      root.querySelector('#val-solar').textContent = fmtW(solarPower);
      root.querySelector('#val-grid').textContent = fmtW(gridPower);
      root.querySelector('#val-batt').textContent = fmtW(battPower);
      root.querySelector('#val-house').textContent = fmtW(housePower);

      // SOC ring: circumference = 2*pi*30 = 188.495
      const circumference = 188.5;
      const offset = circumference * (1 - clamp(soc, 0, 100) / 100);
      const ring = root.querySelector('#hubRing');
      ring.style.strokeDashoffset = String(offset);
      const socLevel = soc < th.soc_critical ? 'crit' : soc < th.soc_warning ? 'warn' : 'ok';
      ring.setAttribute('stroke', { crit: '#ff5b5b', warn: '#ffb020', ok: '#3ee08a' }[socLevel]);
      ring.setAttribute('class', `vc-hub-ring soc-${socLevel}`); // lcars style colours the ring from this class
      root.querySelector('#hubPct').textContent = `${Math.round(soc)}%`;

      // direction +1 = along the path as drawn (outer node -> hub, except car: hub -> car)
      this._setFlow('solar', solarPower, 1, 'solar');
      this._setFlow('house', housePower, -1, '');
      this._setFlow('grid', gridPower, gridPower >= 0 ? 1 : -1, gridPower < 0 ? 'export' : '');
      this._setFlow('batt', battPower, battPower < 0 ? 1 : -1, battPower > 0 ? 'export' : '');

      if (this._hasCar) {
        root.querySelector('#val-car').textContent = fmtW(carPower);
        this._setFlow('car', carPower, carPower >= 0 ? 1 : -1, 'car');

        const sub = root.querySelector('#sub-car');
        if (sub) {
          const s = this._state(e.car_status, '');
          sub.textContent = !s || s === 'unknown' || s === 'unavailable' ? '' : s;
        }
        const plug = e.car_plug ? String(this._state(e.car_plug, '')).toLowerCase() : '';
        root.querySelector('#node-car').classList.toggle('dim', plug.includes('disconnected'));
      }
    }

    // stat strip (only the tiles that have an entity configured)
    (this._statDefsActive || []).forEach((d) => {
      const el = root.querySelector(`#stat-${d.key}`);
      if (!el) return;
      const unit = this._attr(e[d.key], 'unit_of_measurement', d.unit);
      el.textContent = `${this._num(e[d.key], 0).toFixed(d.dp)} ${unit}`;
    });

    // segmented controls
    if (this._sections.ess_mode) {
      this._syncSegments('ess');
      const essState = this._state(e.ess_mode, '');
      root.querySelectorAll('#essSeg .vc-seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.opt === essState));
    }
    if (this._sections.multiplus_mode) {
      this._syncSegments('mp');
      const mpState = this._state(e.multiplus_mode, '');
      root.querySelectorAll('#mpSeg .vc-seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.opt === mpState));
    }

    // charge slider (skip while user is dragging it)
    if (this._sections.charge_current && !this._dragging) {
      const { min, max } = this._sliderLimits();
      if (this._syncSliderRange(min, max)) {
        const val = this._num(e.max_charge_current, min);
        const slider = root.querySelector('#chargeSlider');
        slider.value = val;
        this._paintSlider(val);
        this._syncChargeChips(val);
      } else {
        root.querySelector('#chargeVal').textContent = '—';
      }
    }

    this._updateExtra();

    // automations toggle
    if (this._sections.automations_toggle && e.automations_enabled) {
      const sw = root.querySelector('#autoSwitch');
      const autoOn = this._state(e.automations_enabled, 'off') === 'on';
      if (sw) sw.classList.toggle('on', autoOn);
      if (sw && sw.parentElement) sw.parentElement.classList.toggle('on', autoOn); // light style tints the row
      const label = root.querySelector('#autoLabel');
      if (label) {
        label.textContent = L.automations || this._attr(e.automations_enabled, 'friendly_name', e.automations_enabled);
      }
    }

    this._renderWarnings();
  }

  // Lists configured entities that do not exist in HA (typos, renamed or removed entities).
  _renderWarnings() {
    const host = this._root.querySelector('#warnHost');
    if (!host) return;
    const gone = Object.entries(this._entities)
      .filter(([, id]) => id && !this._st(id))
      .map(([k, id]) => `<code>${esc(k)}</code> → <code>${esc(id)}</code>`);
    (this._extra || []).forEach((x) => {
      if (!this._st(x.entity)) gone.push(`<code>extra_sliders</code> → <code>${esc(x.entity)}</code>`);
    });
    const html = gone.length
      ? `<div class="vc-notice warn"><b>Entity not found:</b><br>${gone.join('<br>')}</div>`
      : '';
    if (host.innerHTML !== html) host.innerHTML = html;
  }
}

customElements.define('victron-ess-card', VictronEssCard);

// Register with the card picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'victron-ess-card',
  name: 'Victron ESS Card',
  description: 'Animated Victron ESS control center — power flow (with optional EV charger), SOC ring, ESS/MultiPlus mode, charge current. Fully configured from the card YAML.',
});