/**
 * control-panel-card.js  v2.1.0  (formerly toggle-info-card.js)
 *
 * A Lovelace card that lists settings (toggles, sliders, selects, times, buttons, read-only values) with
 * a one-line brief for each and a round "?" button. Tapping the "?" opens a
 * dialog with the longer explanation (and the switch, so you can flip it while
 * reading about it).
 *
 * Install: copy to /config/www/community/nevvyn-cards/control-panel-card.js (next to victron-ess-card.js).
 * It is loaded by the inline "ess-cards loader" dashboard resource, which re-checks the file on every
 * page load, so a replaced file is picked up without any version number. Without the loader, add the
 * dashboard resource (type: module)
 *   /local/community/nevvyn-cards/control-panel-card.js?v=3
 *
 * Example:
 *   type: custom:control-panel-card   (the old name custom:toggle-info-card still works as an alias)
 *   title: ID-10T Settings
 *   style: light              # light (default, follows your HA theme) | dark (Victron blue) | lcars
 *                             #   (the old value "normal" still works and means light)
 *   line_style: angular       # angular (default, cut corners) | curved (rounded) - dark and light styles
 *   header_icon: mdi:tune-variant   # icon in the header badge (dark style only)
 *   toggles:                  # "entities:" works too
 *     - entity: input_boolean.iog_dynamic_charging
 *       brief: One line shown under the name.
 *       description: |
 *         Longer text shown when "?" is tapped. Blank line = new paragraph,
 *         "- " starts a bullet, **bold**, *italic* and `code` work.
 *     - entity: input_boolean.iog_disable_charging
 *       invert: true            # shows ON when the entity is off (the switch still flips the real entity)
 *       on_label: Charging allowed     # optional words for the "?" dialog (shown for the displayed state)
 *       off_label: Charging blocked
 *     - entity: input_number.ess_overnight_target_soc      # slider (input_number / number)
 *       min: 50                 # optional - defaults to the entity's own min / max / step
 *       max: 100
 *       step: 1
 *       unit: "%"
 *     - entity: input_select.something                     # drop-down (input_select / select)
 *       option_labels: { opt_a: Nice name }                # optional
 *     - entity: input_datetime.ev_ready_by                 # time picker (input_datetime)
 *       time_picker: native     # native (default) = the phone's own time picker (Android clock dial / iOS
 *                               #   wheels, desktop browsers get a typed time field), list = drop-down
 *       time_step: 30           # list only: minutes between the choices, 1-720 (default 30). A time that
 *                               #   is not on the grid (23:45 with a 30 minute step) is kept and shown too.
 *                               #   Helpers that also hold a date get a native date or date+time picker.
 *                               #   12h/24h display follows the device's own clock setting.
 *     - entity: input_button.free_electricity_calculate    # button (input_button / button / script / scene)
 *       button_label: Calculate
 *     - entity: sensor.gx_device_dc_battery_charge         # read-only value (sensor / binary_sensor / anything else)
 *
 * Type is picked from the entity domain; force it with  type: toggle | slider | select | time | button | sensor
 * `invert` also works on a binary_sensor shown as a read-only indicator.
 */
(() => {
  const VERSION = '2.1.0';
  if (customElements.get('control-panel-card')) return;

  /* ---------- tiny helpers ---------- */

  const esc = (s) =>
    String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  // Escape first, then apply a few safe inline patterns.
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');

  // Minimal markdown: paragraphs, "- " bullets, **bold**, *italic*, `code`.
  const md = (text) => {
    const blocks = String(text || '').trim().split(/\n\s*\n/).filter(Boolean);
    return blocks
      .map((block) => {
        const lines = block.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return (
            '<ul>' +
            lines.map((l) => '<li>' + inline(l.replace(/^\s*[-*]\s+/, '')) + '</li>').join('') +
            '</ul>'
          );
        }
        return '<p>' + lines.map((l) => inline(l.trim())).join(' ') + '</p>';
      })
      .join('');
  };

  const ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;

  /* ---------- controls for the non-toggle types (shared by rows and dialog) ---------- */

  const CONTROL_CSS = `
    .row[data-state="info"] { border-left-color: var(--tic-accent); }
    .row[data-state="info"] ha-icon { color: var(--tic-accent); }
    .dialog[data-state="info"] { border-top-color: var(--tic-accent); }
    .dialog[data-state="info"] ha-icon { color: var(--tic-accent); }
    .ctl { display: flex; align-items: center; gap: 10px; flex: none; }
    .ctl.toggle { display: contents; }
    .rng {
      flex: 1 1 auto; min-width: 80px; margin: 0; height: 6px; border-radius: 999px; outline: none;
      -webkit-appearance: none; appearance: none;
      background: linear-gradient(90deg, var(--tic-accent) var(--fill, 50%), var(--tic-off) var(--fill, 50%));
    }
    .rng:disabled { opacity: .4; }
    .rng::-webkit-slider-thumb {
      -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; border: 0; cursor: pointer;
      background: var(--tic-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--tic-accent) 30%, transparent);
    }
    .rng::-moz-range-thumb {
      width: 18px; height: 18px; border-radius: 50%; border: 0; cursor: pointer;
      background: var(--tic-accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--tic-accent) 30%, transparent);
    }
    .val { min-width: 56px; text-align: right; font-weight: 600; color: var(--primary-text-color); white-space: nowrap; }
    .ctl.sensor .val { white-space: normal; overflow-wrap: anywhere; text-align: right; padding-right: 6px; }
    .sel {
      font: inherit; max-width: 200px; padding: 6px 8px; cursor: pointer;
      color: var(--primary-text-color); background: var(--card-background-color, #fff); border: 1px solid var(--tic-off);
    }
    .sel.dt { max-width: 240px; }
    .rounded .sel { border-radius: 8px; }
    .act {
      font: inherit; font-size: 0.85rem; padding: 8px 14px; cursor: pointer;
      background: none; border: 1px solid var(--tic-accent); color: var(--tic-accent);
    }
    .rounded .act { border-radius: 18px; }
    .act:disabled, .sel:disabled { opacity: .4; cursor: default; }
  `;

  const DARK_CTL = `
    .dark .row[data-state="info"] { border-left-color: #0d8bff; }
    .dark .row[data-state="info"] ha-icon, .dark .dialog[data-state="info"] ha-icon { color: #7cc4ff; }
    .dark .rng { background: linear-gradient(90deg, #0d8bff var(--fill, 50%), rgba(255,255,255,.14) var(--fill, 50%)); }
    .dark .rng::-webkit-slider-thumb { background: #4fd1ff; box-shadow: 0 0 0 4px rgba(79,209,255,.28); }
    .dark .rng::-moz-range-thumb { background: #4fd1ff; box-shadow: 0 0 0 4px rgba(79,209,255,.28); }
    .dark .val { color: #fff; }
    .dark .sel { background: #0b1526; color: #eaf2ff; border-color: rgba(255,255,255,.25); color-scheme: dark; }
    .dark .act { border-color: #0d8bff; color: #7cc4ff; background: rgba(13,139,255,.12); }
    .dark .dctl { padding-top: 12px; }
  `;

  const LCARS_CTL = `
    .lcars .row[data-state="info"] ha-icon { color: #000; }
    .lcars .dialog[data-state="info"]::before { background: var(--lc-o); }
    .lcars .ctl { gap: 12px; }
    .lcars .rng { height: 10px; border-radius: 0; background: linear-gradient(90deg, var(--lc-o) var(--fill, 50%), var(--lc-dim) var(--fill, 50%)); }
    .lcars .rng::-webkit-slider-thumb { width: 16px; height: 28px; border-radius: 8px; background: var(--lc-p); box-shadow: none; }
    .lcars .rng::-moz-range-thumb { width: 16px; height: 28px; border-radius: 8px; background: var(--lc-p); box-shadow: none; }
    .lcars .val { color: var(--lc-p); font-size: 1.1rem; font-weight: 400; letter-spacing: .08em; }
    .lcars .sel {
      background: #000; color: var(--lc-p); border: 2px solid var(--lc-b); border-radius: 999px;
      letter-spacing: .08em; text-transform: uppercase; padding: 4px 14px; color-scheme: dark;
    }
    .lcars .act {
      border: 0; background: var(--lc-b); color: #000; border-radius: 999px;
      letter-spacing: .1em; text-transform: uppercase; padding: 8px 18px;
    }
    .lcars .row .ctl.slider { padding: 2px 14px 12px 94px; }
    .lcars .dctl { padding: 6px 14px 10px 22px; }
  `;

  /* ---------- styles ---------- */

  const COMMON_VARS = `
    --tic-accent: var(--tic-accent-color, var(--primary-color, #03a9f4));
    --tic-off: var(--tic-off-color, var(--disabled-text-color, #9e9e9e));
    --tic-font: var(--tic-font-family, inherit);
  `;

  const CARD_CSS = `
    :host { display: block; }
    ha-card { ${COMMON_VARS} font-family: var(--tic-font); padding: 12px; overflow: hidden; }
    .head { display: flex; align-items: baseline; gap: 12px; padding: 4px 4px 10px; }
    .titles { flex: 1; min-width: 0; }
    .title { font-size: 1.15rem; font-weight: 600; color: var(--primary-text-color); }
    .subtitle { font-size: 0.85rem; color: var(--secondary-text-color); }
    .count { font-size: 0.8rem; color: var(--secondary-text-color); white-space: nowrap; }
    .head .hicon { display: none; }
    .group {
      margin: 12px 4px 4px; font-size: 0.75rem; letter-spacing: 0.08em;
      text-transform: uppercase; color: var(--secondary-text-color);
    }
    .group:first-child { margin-top: 0; }
    .list { display: flex; flex-direction: column; gap: 6px; }

    .row {
      display: flex; align-items: center; gap: 4px; min-height: 56px;
      padding: 0 4px 0 0;
      background: var(--secondary-background-color, rgba(127,127,127,.12));
      border-left: 6px solid var(--tic-off);
      transition: background .2s, border-color .2s;
    }
    .angular .row {
      clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
    }
    .rounded .row { border-radius: 12px; }
    .row[data-state="on"] {
      border-left-color: var(--tic-accent);
      background: color-mix(in srgb, var(--tic-accent) 14%, var(--secondary-background-color, transparent));
    }
    .row[data-state="unavailable"] { opacity: 0.55; }

    .main {
      flex: 1; min-width: 0; display: flex; align-items: center; gap: 12px;
      padding: 8px 4px 8px 10px; background: none; border: 0; cursor: pointer;
      text-align: left; font: inherit; color: inherit;
    }
    ha-icon { --mdc-icon-size: 24px; color: var(--tic-off); flex: none; }
    .row[data-state="on"] ha-icon { color: var(--tic-accent); }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .name { font-weight: 500; color: var(--primary-text-color); overflow-wrap: anywhere; }
    .brief { font-size: 0.82rem; color: var(--secondary-text-color); overflow-wrap: anywhere; }

    .help, .sw { background: none; border: 0; cursor: pointer; padding: 0; flex: none; }
    .help { width: 44px; height: 44px; display: grid; place-items: center; }
    .help span {
      width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center;
      border: 2px solid var(--secondary-text-color); color: var(--secondary-text-color);
      font-size: 0.8rem; font-weight: 700; line-height: 1; transition: .15s;
    }
    .help:hover span, .help:focus-visible span {
      border-color: var(--tic-accent); color: var(--tic-accent);
    }
    .sw { width: 54px; height: 44px; display: grid; place-items: center; }
    .track {
      width: 38px; height: 20px; border-radius: 10px; position: relative;
      background: var(--tic-off); opacity: .6; transition: .2s;
    }
    .knob {
      position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
      background: #fff; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.4);
    }
    .sw[aria-checked="true"] .track { background: var(--tic-accent); opacity: 1; }
    .sw[aria-checked="true"] .knob { left: 20px; }
    .sw:disabled { cursor: default; }
    button:focus-visible { outline: 2px solid var(--tic-accent); outline-offset: 2px; }
    .empty { padding: 16px; color: var(--secondary-text-color); }
    .row[data-type="slider"] { flex-wrap: wrap; }
    .row .ctl.slider { flex: 1 1 100%; order: 9; padding: 0 14px 10px 20px; box-sizing: border-box; }
    ${CONTROL_CSS}
  `;

  const DIALOG_CSS = `
    :host { ${COMMON_VARS} }
    .overlay {
      position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center;
      justify-content: center; padding: 16px; box-sizing: border-box;
      background: rgba(0,0,0,.55); font-family: var(--tic-font);
    }
    .dialog {
      width: min(520px, 100%); max-height: 85vh; display: flex; flex-direction: column;
      background: var(--card-background-color, #fff); color: var(--primary-text-color);
      border-top: 6px solid var(--tic-off); box-shadow: 0 8px 32px rgba(0,0,0,.5);
    }
    .dialog[data-state="on"] { border-top-color: var(--tic-accent); }
    .angular .dialog {
      clip-path: polygon(0 0, calc(100% - 22px) 0, 100% 22px, 100% 100%, 22px 100%, 0 calc(100% - 22px));
    }
    .rounded .dialog { border-radius: 16px; }
    .dhead { display: flex; align-items: center; gap: 12px; padding: 16px 8px 8px 20px; }
    ha-icon { --mdc-icon-size: 26px; color: var(--tic-off); flex: none; }
    .dialog[data-state="on"] ha-icon { color: var(--tic-accent); }
    .dtitle { flex: 1; font-size: 1.2rem; font-weight: 600; overflow-wrap: anywhere; }
    .close {
      width: 44px; height: 44px; background: none; border: 0; cursor: pointer;
      color: var(--secondary-text-color); font-size: 1.6rem; line-height: 1;
    }
    .dstate {
      display: flex; align-items: center; gap: 12px; padding: 0 8px 4px 20px;
      color: var(--secondary-text-color); font-size: 0.9rem;
    }
    .dstate .label { flex: 1; }
    .sw { width: 54px; height: 44px; display: grid; place-items: center; background: none; border: 0; cursor: pointer; padding: 0; }
    .track { width: 38px; height: 20px; border-radius: 10px; position: relative; background: var(--tic-off); opacity: .6; transition: .2s; }
    .knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: .2s; box-shadow: 0 1px 3px rgba(0,0,0,.4); }
    .sw[aria-checked="true"] .track { background: var(--tic-accent); opacity: 1; }
    .sw[aria-checked="true"] .knob { left: 20px; }
    .sw:disabled { cursor: default; }
    .dbody { padding: 8px 20px 12px; overflow-y: auto; line-height: 1.5; }
    .dbody p { margin: 0 0 12px; }
    .dbody ul { margin: 0 0 12px; padding-left: 22px; }
    .dbody code { background: var(--secondary-background-color, rgba(127,127,127,.2)); padding: 1px 5px; border-radius: 4px; }
    .dfoot { display: flex; align-items: center; gap: 12px; padding: 8px 12px 16px 20px; }
    .eid { flex: 1; min-width: 0; font-size: 0.75rem; color: var(--secondary-text-color); overflow-wrap: anywhere; }
    .more {
      background: none; border: 1px solid var(--tic-accent); color: var(--tic-accent);
      padding: 8px 14px; cursor: pointer; font: inherit; font-size: 0.85rem;
    }
    .rounded .more { border-radius: 18px; }
    button:focus-visible { outline: 2px solid var(--tic-accent); outline-offset: 2px; }
    .dctl { display: flex; padding: 4px 20px 8px; }
    .dctl .ctl { flex: 1 1 auto; }
    ${CONTROL_CSS}
  `;

  /* ---------- LCARS look (layered on top of the normal CSS when style: lcars) ---------- */

  const LCARS_VARS = `
    --lc-o:#ff9900; --lc-p:#ffcc99; --lc-v:#cc99cc; --lc-b:#9999ff; --lc-t:#ffcc66; --lc-dim:#4a3d5c;
    --tic-accent: var(--lc-o); --tic-off: var(--lc-dim);
  `;
  const LCARS_FONT = 'Antonio, Okuda, "Helvetica Neue", Arial, sans-serif';

  const LCARS_CARD_CSS = `
    ha-card.lcars {
      ${LCARS_VARS}
      background:#000; padding:0 0 16px; border-radius:36px 8px 8px 8px;
      font-family:${LCARS_FONT}; letter-spacing:.06em; text-transform:uppercase;
    }
    .lcars .head { position:relative; padding:0; gap:0; min-height:56px; align-items:stretch; margin-bottom:18px; }
    .lcars .head::before { content:""; flex:0 0 86px; background:var(--lc-o); border-radius:36px 0 0 0; margin-right:6px; }
    .lcars .head::after {
      content:""; position:absolute; left:0; right:0; bottom:-7px; height:6px;
      background:linear-gradient(90deg, var(--lc-o) 0 86px, #000 86px 92px, var(--lc-v) 92px 55%, #000 55% calc(55% + 6px), var(--lc-b) calc(55% + 6px) 100%);
    }
    .lcars .titles { display:flex; flex-direction:column; justify-content:center; padding:10px 0; }
    .lcars .title { color:var(--lc-o); font-size:1.5rem; font-weight:400; letter-spacing:.12em; line-height:1.1; }
    .lcars .subtitle { color:var(--lc-v); font-size:.85rem; letter-spacing:.14em; }
    .lcars .count {
      align-self:center; margin-right:14px; background:var(--lc-v); color:#000;
      padding:5px 16px 5px 12px; border-radius:0 18px 18px 0; font-size:.9rem; letter-spacing:.1em;
    }
    .lcars .list { gap:6px; padding-right:14px; }
    .lcars .group { margin:14px 14px 4px 92px; color:var(--lc-v); font-size:.85rem; letter-spacing:.16em; }
    .lcars .group:first-child { margin-top:0; }

    .lcars .row {
      --blk: var(--lc-o);
      background:#000; border-left:0; border-radius:0; clip-path:none;
      min-height:54px; padding:0; gap:6px; align-items:stretch;
    }
    .lcars .row[data-c="1"] { --blk: var(--lc-v); }
    .lcars .row[data-c="2"] { --blk: var(--lc-b); }
    .lcars .row[data-c="3"] { --blk: var(--lc-t); }
    .lcars .row[data-state="off"] { --blk: var(--lc-dim); }
    .lcars .row[data-state="on"] { background:#000; }
    .lcars .main { padding:0 8px 0 0; gap:14px; align-items:stretch; }
    .lcars ha-icon {
      --mdc-icon-size:28px; display:flex; align-items:center; justify-content:center;
      flex:none; align-self:stretch; width:80px; background:var(--blk); color:#000;
      border-radius:27px 0 0 27px;
    }
    .lcars .row[data-state="on"] ha-icon, .lcars .row[data-state="off"] ha-icon { color:#000; }
    .lcars .row[data-state="off"] ha-icon { color:var(--lc-p); }
    .lcars .text { justify-content:center; }
    .lcars .name { color:var(--lc-p); font-size:1.1rem; font-weight:400; letter-spacing:.1em; }
    .lcars .brief { color:var(--lc-v); font-size:.85rem; letter-spacing:.03em; text-transform:none; }

    .lcars .help { width:48px; }
    .lcars .help span {
      width:28px; height:28px; border:0; background:var(--lc-b); color:#000;
      font-size:1.05rem; font-weight:400; font-family:inherit;
    }
    .lcars .help:hover span, .lcars .help:focus-visible span { background:var(--lc-p); color:#000; border:0; }
    .lcars .sw { width:76px; }
    .lcars .track {
      width:62px; height:28px; border-radius:14px; background:var(--lc-dim); opacity:1;
      display:grid; place-items:center;
    }
    .lcars .track::after { content:"OFF"; color:var(--lc-p); font-size:.85rem; letter-spacing:.1em; }
    .lcars .sw[aria-checked="true"] .track { background:var(--lc-o); }
    .lcars .sw[aria-checked="true"] .track::after { content:"ON"; color:#000; }
    .lcars .knob { display:none; }
    .lcars .empty { color:var(--lc-v); }
    ${LCARS_CTL}
  `;

  const LCARS_DIALOG_CSS = `
    .overlay.lcars { ${LCARS_VARS} font-family:${LCARS_FONT}; }
    .lcars .dialog {
      background:#000; border:0; border-radius:36px 8px 8px 8px; clip-path:none; box-shadow:none;
      letter-spacing:.06em; text-transform:uppercase; overflow:hidden;
    }
    .lcars .dialog::before { content:""; flex:none; height:18px; background:var(--lc-dim); border-radius:36px 8px 0 0; margin-bottom:6px; }
    .lcars .dialog[data-state="on"]::before { background:var(--lc-o); }
    .lcars .dhead { padding:10px 14px 6px 22px; }
    .lcars ha-icon { color:var(--lc-v); }
    .lcars .dialog[data-state="on"] ha-icon { color:var(--lc-o); }
    .lcars .dtitle { color:var(--lc-o); font-size:1.5rem; font-weight:400; letter-spacing:.12em; }
    .lcars .close {
      width:auto; height:34px; padding:0 18px; border-radius:17px; background:var(--lc-v); color:#000;
      font:inherit; font-size:1rem; letter-spacing:.12em;
    }
    .lcars .dstate { padding:0 14px 6px 22px; color:var(--lc-v); font-size:1rem; letter-spacing:.14em; }
    .lcars .track { width:62px; height:28px; border-radius:14px; background:var(--lc-dim); opacity:1; display:grid; place-items:center; }
    .lcars .track::after { content:"OFF"; color:var(--lc-p); font-size:.85rem; letter-spacing:.1em; }
    .lcars .sw[aria-checked="true"] .track { background:var(--lc-o); }
    .lcars .sw[aria-checked="true"] .track::after { content:"ON"; color:#000; }
    .lcars .sw { width:76px; }
    .lcars .knob { display:none; }
    .lcars .dbody { color:var(--lc-p); font-size:1.1rem; letter-spacing:.02em; text-transform:none; padding:8px 22px 14px; }
    .lcars .dbody code { background:#1c1626; color:var(--lc-t); }
    .lcars .dfoot { padding:8px 14px 18px 22px; }
    .lcars .eid { text-transform:none; letter-spacing:.02em; color:var(--lc-v); }
    .lcars .more { border:0; background:var(--lc-b); color:#000; border-radius:17px; padding:8px 18px; font:inherit; font-size:.95rem; letter-spacing:.1em; }
    ${LCARS_CTL}
  `;

  /* ---------- dark look: the Victron ESS card's blue (layered on top of the light CSS) ---------- */

  const DARK_GRADIENT = 'linear-gradient(120deg, #062a4d 0%, #0c4a86 45%, #0b3a6b 100%)';
  const DARK_FONT = 'var(--paper-font-body1_-_font-family, "Segoe UI", Roboto, sans-serif)';

  const DARK_CARD_CSS = `
    @keyframes ticGradient { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    ha-card.dark {
      --tic-accent: #0d8bff; --tic-off: rgba(255,255,255,.22);
      background: #0b1526; color: #eaf2ff; padding: 0 0 16px; border-radius: 18px; font-family: ${DARK_FONT};
    }
    .dark .head {
      position: relative; align-items: center; gap: 12px; padding: 16px 18px 14px; margin-bottom: 12px;
      background: ${DARK_GRADIENT}; background-size: 220% 220%; animation: ticGradient 10s ease infinite;
    }
    .dark .head::after {
      content: ""; position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(circle at 85% -10%, rgba(0,180,255,.35), transparent 55%);
    }
    .dark .head .hicon {
      display: flex; align-items: center; justify-content: center; flex: none; z-index: 1;
      width: 42px; height: 42px; border-radius: 12px; color: #fff; --mdc-icon-size: 24px;
      background: radial-gradient(circle at 30% 30%, #35b6ff, #0071c5 60%, #023e73 100%);
      box-shadow: 0 0 0 1px rgba(255,255,255,.15) inset, 0 4px 14px rgba(0,120,220,.55);
    }
    .dark .titles { z-index: 1; }
    .dark .title { color: #fff; font-size: 16px; font-weight: 700; letter-spacing: .2px; }
    .dark .subtitle { color: #a9d4ff; opacity: .85; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }
    .dark .count {
      z-index: 1; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 999px;
      background: rgba(255,255,255,.12); color: #dff0ff; border: 1px solid rgba(255,255,255,.18);
    }
    .dark .list { padding: 0 14px; }
    .dark .group { margin: 14px 4px 4px; color: #87a6cc; font-size: 11px; font-weight: 700; letter-spacing: .06em; }
    .dark .group:first-child { margin-top: 0; }

    .dark .row {
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
      border-left: 6px solid var(--tic-off);
    }
    .dark .row[data-state="on"] { background: rgba(13,139,255,.16); border-left-color: #0d8bff; }
    .dark .name { color: #fff; }
    .dark .brief { color: #9db8dd; }
    .dark ha-icon { color: #6f89ad; }
    .dark .row[data-state="on"] ha-icon { color: #4fd1ff; }
    .dark .help span { border-color: #87a6cc; color: #87a6cc; }
    .dark .help:hover span, .dark .help:focus-visible span { border-color: #4fd1ff; color: #4fd1ff; }
    .dark .track { background: rgba(255,255,255,.14); opacity: 1; }
    .dark .sw[aria-checked="true"] .track { background: linear-gradient(135deg, #0d8bff, #0055b3); }
    .dark .empty { color: #9db8dd; }
    ${DARK_CTL}
  `;

  const DARK_DIALOG_CSS = `
    .overlay.dark { --tic-accent: #0d8bff; --tic-off: rgba(255,255,255,.22); font-family: ${DARK_FONT}; }
    .dark .dialog { background: #0b1526; color: #eaf2ff; border-top: 0; box-shadow: 0 8px 32px rgba(0,0,0,.6); overflow: hidden; }
    .dark.rounded .dialog { border-radius: 18px; }
    .dark .dhead { background: ${DARK_GRADIENT}; padding: 14px 8px 12px 20px; }
    .dark ha-icon { color: #a9d4ff; }
    .dark .dialog[data-state="on"] ha-icon { color: #4fd1ff; }
    .dark .dtitle { color: #fff; font-size: 1.1rem; font-weight: 700; }
    .dark .close { color: #a9d4ff; }
    .dark .dstate { padding-top: 12px; color: #9db8dd; }
    .dark .track { background: rgba(255,255,255,.14); opacity: 1; }
    .dark .sw[aria-checked="true"] .track { background: linear-gradient(135deg, #0d8bff, #0055b3); }
    .dark .dbody { color: #cfe1f7; }
    .dark .dbody code { background: rgba(255,255,255,.1); }
    .dark .eid { color: #87a6cc; }
    .dark .more { border-color: #0d8bff; color: #7cc4ff; }
    ${DARK_CTL}
  `;

  /* ---------- the card ---------- */

  const TOGGLE_DOMAINS = ['input_boolean', 'switch', 'light', 'fan', 'automation', 'humidifier', 'siren', 'remote', 'group'];
  const SLIDER_DOMAINS = ['input_number', 'number'];
  const SELECT_DOMAINS = ['input_select', 'select'];
  const TIME_DOMAINS = ['input_datetime'];
  const BUTTON_DOMAINS = ['input_button', 'button', 'script', 'scene'];
  const TYPES = ['toggle', 'slider', 'select', 'time', 'button', 'sensor'];
  const domainOf = (id) => String(id).split('.')[0];
  const prettify = (o) => {
    const s = String(o).replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const resolveType = (entity) => {
    const d = domainOf(entity);
    if (TOGGLE_DOMAINS.includes(d)) return 'toggle';
    if (SLIDER_DOMAINS.includes(d)) return 'slider';
    if (SELECT_DOMAINS.includes(d)) return 'select';
    if (TIME_DOMAINS.includes(d)) return 'time';
    if (BUTTON_DOMAINS.includes(d)) return 'button';
    return 'sensor'; // sensor, binary_sensor, anything else: read-only display
  };
  const DEFAULT_ICONS = {
    slider: 'mdi:tune-variant',
    select: 'mdi:format-list-bulleted',
    time: 'mdi:clock-outline',
    button: 'mdi:gesture-tap-button',
    sensor: 'mdi:eye-outline',
  };

  class ControlPanelCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._config = null;
      this._hass = null;
      this._rows = [];
      this._dlg = null;
      this._onKey = this._onKey.bind(this);
    }

    static getStubConfig(hass) {
      const first = hass && Object.keys(hass.states).find((e) => e.startsWith('input_boolean.'));
      return {
        title: 'Settings',
        toggles: [
          {
            entity: first || 'input_boolean.example',
            brief: 'One line shown under the name',
            description: 'The longer explanation shown when the ? is tapped.',
          },
        ],
      };
    }

    setConfig(config) {
      const list = config && (config.toggles || config.entities || config.items);
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('control-panel-card: "toggles" (or "entities") must be a non-empty list');
      }
      const toggles = list.map((t, i) => {
        const item = typeof t === 'string' ? { entity: t } : { ...t };
        if (!item.entity || !ENTITY_RE.test(item.entity)) {
          throw new Error(`control-panel-card: toggles[${i}] needs a valid "entity" (e.g. input_boolean.foo)`);
        }
        if (item.type !== undefined && !TYPES.includes(item.type)) {
          throw new Error(`control-panel-card: toggles[${i}].type must be one of ${TYPES.join(', ')} (got "${item.type}")`);
        }
        item._type = item.type || resolveType(item.entity);
        item.invert = item.invert === true || item.invert === 'true';
        return item;
      });
      // Older values still accepted: style "normal" = light; style "angular"/"rounded" = light + corners.
      const rawStyle = config.style === undefined ? 'light' : config.style;
      const legacyCorners = rawStyle === 'angular' || rawStyle === 'rounded' ? rawStyle : null;
      let style = legacyCorners || rawStyle === 'normal' ? 'light' : rawStyle;
      if (!['dark', 'light', 'lcars'].includes(style)) {
        throw new Error(`control-panel-card: style must be dark, light or lcars (got "${rawStyle}")`);
      }
      if (config.line_style !== undefined && !['curved', 'angular'].includes(config.line_style)) {
        throw new Error(`control-panel-card: line_style must be curved or angular (got "${config.line_style}")`);
      }
      const corners = config.line_style
        ? (config.line_style === 'curved' ? 'rounded' : 'angular')
        : ((config.corners || legacyCorners || 'angular') === 'rounded' ? 'rounded' : 'angular');
      this._config = { ...config, style, corners, toggles };
      this._build();
      if (this._hass) this._update();
    }

    set hass(hass) {
      this._hass = hass;
      this._update();
    }

    getCardSize() {
      return 1 + (this._config ? this._config.toggles.length : 1);
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6, rows: 'auto' };
    }

    disconnectedCallback() {
      this._closeDialog(false);
    }

    _themeClass() {
      const c = this._config;
      return c.style === 'lcars' ? 'lcars' : `${c.style} ${c.corners}`;
    }

    _themeCss(kind) {
      const s = this._config.style;
      if (s === 'lcars') return kind === 'card' ? LCARS_CARD_CSS : LCARS_DIALOG_CSS;
      if (s === 'dark') return kind === 'card' ? DARK_CARD_CSS : DARK_DIALOG_CSS;
      return '';
    }

    /* --- structure (built once per config, then only updated) --- */

    _build() {
      this._closeDialog(false);
      const c = this._config;
      const root = this.shadowRoot;
      // Header badge icon: only the dark style shows it (hidden by CSS everywhere else).
      const headIcon = `<ha-icon class="hicon" icon="${esc(c.header_icon || 'mdi:tune-variant')}"></ha-icon>`;
      root.innerHTML = `
        <style>${CARD_CSS}${this._themeCss('card')}</style>
        <ha-card class="${this._themeClass()}">
          ${
            c.title || c.subtitle
              ? `<div class="head">${headIcon}<div class="titles">
                   ${c.title ? `<div class="title">${esc(c.title)}</div>` : ''}
                   ${c.subtitle ? `<div class="subtitle">${esc(c.subtitle)}</div>` : ''}
                 </div><div class="count"></div></div>`
              : `<div class="head">${headIcon}<div class="titles"></div><div class="count"></div></div>`
          }
          <div class="list"></div>
        </ha-card>`;
      this._countEl = root.querySelector('.count');
      const list = root.querySelector('.list');
      this._rows = [];
      let lastGroup = null;

      c.toggles.forEach((t, i) => {
        if (t.group && t.group !== lastGroup) {
          const g = document.createElement('div');
          g.className = 'group';
          g.textContent = t.group;
          list.appendChild(g);
        }
        lastGroup = t.group || lastGroup;

        const row = document.createElement('div');
        row.className = 'row';
        row.dataset.c = String(i % 4); // lcars colour block cycles through four colours
        row.dataset.type = t._type;
        row.innerHTML = `
          <button class="main" type="button">
            <ha-icon></ha-icon>
            <span class="text"><span class="name"></span><span class="brief"></span></span>
          </button>
          <button class="help" type="button" title="What does this do?"><span>?</span></button>`;
        const ctl = this._control(t);
        row.appendChild(ctl.el);
        const refs = {
          t,
          i,
          ctl,
          el: row,
          icon: row.querySelector('ha-icon'),
          name: row.querySelector('.name'),
          brief: row.querySelector('.brief'),
          help: row.querySelector('.help'),
        };
        refs.brief.style.display = t.brief ? '' : 'none';
        refs.brief.textContent = t.brief || '';

        row.querySelector('.main').addEventListener('click', () => this._moreInfo(t.entity));
        refs.help.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this._openDialog(i, refs.help);
        });
        list.appendChild(row);
        this._rows.push(refs);
      });
    }

    /* --- controls: one per entity type, used both in the row and in the "?" dialog --- */

    _control(t) {
      const entity = t.entity;
      const dom = domainOf(entity);
      const call = (service, data, d = dom) => {
        if (!this._hass) return;
        this._hass.callService(d, service, { entity_id: entity, ...data });
        this._haptic();
      };
      const wrap = document.createElement('div');
      wrap.className = `ctl ${t._type}`;

      if (t._type === 'toggle') {
        wrap.innerHTML = '<button class="sw" type="button" role="switch" aria-checked="false"><span class="track"><span class="knob"></span></span></button>';
        const sw = wrap.firstChild;
        sw.addEventListener('click', (ev) => {
          ev.stopPropagation();
          this._toggle(entity);
        });
        return {
          el: wrap,
          update: (s) => {
            sw.setAttribute('aria-checked', String(s.state === 'on'));
            sw.setAttribute('aria-label', `${s.name}: ${s.text}`);
            sw.disabled = s.state === 'unavailable';
          },
        };
      }

      if (t._type === 'slider') {
        wrap.innerHTML = '<input type="range" class="rng"><span class="val">—</span>';
        const rng = wrap.querySelector('.rng');
        const val = wrap.querySelector('.val');
        let dragging = false;
        let unit = '';
        const paint = (v) => {
          const min = parseFloat(rng.min), max = parseFloat(rng.max);
          const pct = ((v - min) / (max - min || 1)) * 100;
          rng.style.setProperty('--fill', `${Math.min(100, Math.max(0, pct))}%`);
          val.textContent = `${v}${unit ? ' ' + unit : ''}`;
        };
        rng.addEventListener('input', () => {
          dragging = true;
          paint(parseFloat(rng.value));
        });
        rng.addEventListener('change', () => {
          call('set_value', { value: parseFloat(rng.value) });
          dragging = false;
        });
        return {
          el: wrap,
          update: (s) => {
            if (dragging) return;
            const a = (s.st && s.st.attributes) || {};
            const pick = (...v) => v.map(Number).find((n, i) => v[i] !== undefined && v[i] !== null && v[i] !== '' && Number.isFinite(n));
            const min = pick(t.min, a.min, 0);
            const max = pick(t.max, a.max, 100);
            rng.min = min;
            rng.max = max;
            rng.step = pick(t.step, a.step, 1);
            unit = t.unit !== undefined ? t.unit : (a.unit_of_measurement || '');
            const v = parseFloat(s.raw);
            const ok = s.state !== 'unavailable' && Number.isFinite(v);
            rng.disabled = !ok;
            if (!ok) { val.textContent = '—'; return; }
            rng.value = v;
            paint(v);
          },
        };
      }

      if (t._type === 'select') {
        wrap.innerHTML = '<select class="sel"></select>';
        const sel = wrap.firstChild;
        let sig = null;
        sel.addEventListener('click', (ev) => ev.stopPropagation());
        sel.addEventListener('change', () => call('select_option', { option: sel.value }));
        return {
          el: wrap,
          update: (s) => {
            const a = (s.st && s.st.attributes) || {};
            const opts = Array.isArray(t.options) ? t.options : Array.isArray(a.options) ? a.options : [];
            const labels = t.option_labels || {};
            const nsig = opts.join('|') + '#' + JSON.stringify(labels);
            if (nsig !== sig) {
              sig = nsig;
              sel.innerHTML = '';
              opts.forEach((o) => {
                const op = document.createElement('option');
                op.value = o;
                op.textContent = labels[o] || prettify(o);
                sel.appendChild(op);
              });
            }
            sel.disabled = s.state === 'unavailable';
            if (sel.value !== s.raw && opts.includes(s.raw)) sel.value = s.raw;
          },
        };
      }

      if (t._type === 'time') {
        // input_datetime. Time only: a drop-down of times every `time_step` minutes (default 30).
        // Date only / date+time: the browser's own date or date+time picker.
        const stepMin = Math.max(1, Math.min(720, parseInt(t.time_step, 10) || 30));
        const pad = (n) => String(n).padStart(2, '0');
        const useList = String(t.time_picker || 'native').toLowerCase() === 'list';
        let mode = null; // 'time' | 'date' | 'datetime'
        let ctrl = null;
        let sig = null;
        const make = (m) => {
          wrap.innerHTML = '';
          if (m === 'time' && useList) {
            ctrl = document.createElement('select');
            ctrl.className = 'sel';
          } else if (m === 'time') {
            ctrl = document.createElement('input');
            ctrl.type = 'time';
            ctrl.className = 'sel dt';
          } else {
            ctrl = document.createElement('input');
            ctrl.type = m === 'date' ? 'date' : 'datetime-local';
            ctrl.className = 'sel dt';
          }
          ctrl.addEventListener('click', (ev) => ev.stopPropagation());
          ctrl.addEventListener('change', () => {
            const v = ctrl.value;
            if (!v) return;
            if (m === 'time') call('set_datetime', { time: v + ':00' });
            else if (m === 'date') call('set_datetime', { date: v });
            else call('set_datetime', { datetime: v.replace('T', ' ') + ':00' });
          });
          wrap.appendChild(ctrl);
          mode = m;
          sig = null;
        };
        return {
          el: wrap,
          update: (s) => {
            const a = (s.st && s.st.attributes) || {};
            const hasDate = a.has_date === true;
            const hasTime = a.has_time !== false;
            const m = hasDate ? (hasTime ? 'datetime' : 'date') : 'time';
            if (m !== mode) make(m);
            ctrl.disabled = s.state === 'unavailable';
            const raw = String(s.raw || '');
            if (m === 'time' && !useList) {
              const cur = /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : '';
              if (ctrl.value !== cur) ctrl.value = cur;
            } else if (m === 'time') {
              const cur = /^\d{2}:\d{2}/.test(raw) ? raw.slice(0, 5) : '';
              const opts = [];
              for (let mins = 0; mins < 1440; mins += stepMin) opts.push(`${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`);
              if (cur && !opts.includes(cur)) { opts.push(cur); opts.sort(); }
              const nsig = (cur ? '' : '!') + opts.join('|');
              if (nsig !== sig) {
                sig = nsig;
                ctrl.innerHTML = '';
                if (!cur) {
                  const ph = document.createElement('option');
                  ph.value = '';
                  ph.textContent = '--:--';
                  ph.disabled = true;
                  ph.selected = true;
                  ctrl.appendChild(ph);
                }
                opts.forEach((o) => {
                  const op = document.createElement('option');
                  op.value = o;
                  op.textContent = o;
                  ctrl.appendChild(op);
                });
              }
              if (cur && ctrl.value !== cur) ctrl.value = cur;
            } else if (m === 'date') {
              const d = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : '';
              if (ctrl.value !== d) ctrl.value = d;
            } else {
              const mm = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
              const dt = mm ? `${mm[1]}T${mm[2]}` : '';
              if (ctrl.value !== dt) ctrl.value = dt;
            }
          },
        };
      }

      if (t._type === 'button') {
        wrap.innerHTML = '<button class="act" type="button"></button>';
        const b = wrap.firstChild;
        b.textContent = t.button_label || (dom === 'script' ? 'Run' : dom === 'scene' ? 'Apply' : 'Press');
        b.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (dom === 'input_button' || dom === 'button') call('press');
          else if (dom === 'script' || dom === 'scene') call('turn_on');
          else call('turn_on', {}, 'homeassistant');
        });
        return { el: wrap, update: (s) => { b.disabled = s.state === 'unavailable'; } };
      }

      // sensor: read-only value
      wrap.innerHTML = '<span class="val"></span>';
      const val = wrap.firstChild;
      return {
        el: wrap,
        update: (s) => {
          if (val.textContent !== s.text) val.textContent = s.text;
        },
      };
    }

    /* --- state --- */

    // `state` is what the card DISPLAYS: on / off / info (a value, not an on/off thing) / unavailable.
    // With invert: true an entity that is on is shown as off (and the other way round); the switch
    // still flips the real entity, only the picture and the words are reversed.
    _stateOf(t) {
      const st = this._hass && this._hass.states[t.entity];
      const raw = st ? st.state : 'unavailable';
      const binary = t._type === 'toggle' || domainOf(t.entity) === 'binary_sensor';
      let state;
      let text;
      if (raw === 'unavailable' || !st || (raw === 'unknown' && t._type === 'toggle')) {
        state = 'unavailable';
        text = 'Unavailable';
      } else if (binary && (raw === 'on' || raw === 'off')) {
        state = (raw === 'on') !== !!t.invert ? 'on' : 'off';
        text = state === 'on' ? t.on_label || 'On' : t.off_label || 'Off';
      } else if (binary) {
        state = 'unavailable';
        text = raw;
      } else {
        state = 'info';
        text = raw;
        if (typeof this._hass.formatEntityState === 'function') {
          try { text = this._hass.formatEntityState(st); } catch (e) { /* keep raw */ }
        } else if (st.attributes.unit_of_measurement) {
          text = `${raw} ${st.attributes.unit_of_measurement}`;
        }
      }
      return {
        st,
        raw,
        state,
        text,
        name: t.name || (st && st.attributes.friendly_name) || t.entity,
        icon:
          t.icon ||
          (st && st.attributes.icon) ||
          (t._type === 'toggle' || binary
            ? state === 'on' ? 'mdi:toggle-switch' : 'mdi:toggle-switch-off-outline'
            : DEFAULT_ICONS[t._type]),
      };
    }

    _update() {
      if (!this._hass || !this._rows.length) return;
      let on = 0;
      let n = 0;
      this._rows.forEach((r) => {
        const s = this._stateOf(r.t);
        if (r.t._type === 'toggle') {
          n += 1;
          if (s.state === 'on') on += 1;
        }
        r.el.dataset.state = s.state;
        if (r.name.textContent !== s.name) r.name.textContent = s.name;
        if (r.icon.getAttribute('icon') !== s.icon) r.icon.setAttribute('icon', s.icon);
        r.ctl.update(s);
        r.help.setAttribute('aria-label', `About ${s.name}`);
      });
      if (this._countEl) {
        this._countEl.textContent = n ? `${on} of ${n} on` : '';
        this._countEl.style.display = n ? '' : 'none';
      }
      this._updateDialog();
    }

    _haptic() {
      this.dispatchEvent(new CustomEvent('haptic', { detail: 'light', bubbles: true, composed: true }));
    }

    _toggle(entity) {
      if (!this._hass) return;
      const st = this._hass.states[entity];
      if (!st || (st.state !== 'on' && st.state !== 'off')) return;
      this._hass.callService('homeassistant', st.state === 'on' ? 'turn_off' : 'turn_on', {
        entity_id: entity,
      });
      this._haptic();
    }

    _moreInfo(entity) {
      this.dispatchEvent(
        new CustomEvent('hass-more-info', { detail: { entityId: entity }, bubbles: true, composed: true })
      );
    }

    /* --- the "?" dialog (attached to <body> so no card/ancestor can clip it) --- */

    _openDialog(i, trigger) {
      this._closeDialog(false);
      const t = this._config.toggles[i];
      const host = document.createElement('div');
      const sh = host.attachShadow({ mode: 'open' });
      const body = t.description ? md(t.description) : t.brief ? md(t.brief) : '';
      const showState = t._type === 'toggle' || t._type === 'sensor';
      sh.innerHTML = `
        <style>${DIALOG_CSS}${this._themeCss('dialog')}</style>
        <div class="overlay ${this._themeClass()}">
          <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dt" data-state="off">
            <div class="dhead">
              <ha-icon></ha-icon>
              <div class="dtitle" id="dt"></div>
              <button class="close" type="button" aria-label="Close">${this._config.style === 'lcars' ? 'Close' : '&times;'}</button>
            </div>
            ${showState ? '<div class="dstate"><span class="label"></span></div>' : '<div class="dctl"></div>'}
            <div class="dbody">${body || '<p><em>No description has been added for this setting yet.</em></p>'}</div>
            <div class="dfoot">
              <span class="eid">${esc(t.entity)}</span>
              <button class="more" type="button">Entity details</button>
            </div>
          </div>
        </div>`;
      const q = (s) => sh.querySelector(s);
      q('.overlay').addEventListener('click', (ev) => {
        if (ev.target === ev.currentTarget) this._closeDialog(true);
      });
      q('.close').addEventListener('click', () => this._closeDialog(true));
      let ctl = null;
      if (t._type !== 'sensor') {
        ctl = this._control(t);
        q(showState ? '.dstate' : '.dctl').appendChild(ctl.el);
      }
      q('.more').addEventListener('click', () => {
        this._closeDialog(false);
        this._moreInfo(t.entity);
      });
      document.body.appendChild(host);
      document.addEventListener('keydown', this._onKey, true);
      this._dlg = { host, sh, t, trigger, ctl };
      this._updateDialog();
      q('.close').focus();
    }

    _updateDialog() {
      if (!this._dlg || !this._hass) return;
      const { sh, t, ctl } = this._dlg;
      const s = this._stateOf(t);
      sh.querySelector('.dialog').dataset.state = s.state;
      sh.querySelector('ha-icon').setAttribute('icon', s.icon);
      sh.querySelector('.dtitle').textContent = s.name;
      const label = sh.querySelector('.label');
      if (label) label.textContent = s.text;
      if (ctl) ctl.update(s);
    }

    _onKey(ev) {
      if (ev.key === 'Escape' && this._dlg) {
        ev.stopPropagation();
        this._closeDialog(true);
      }
    }

    _closeDialog(restoreFocus) {
      if (!this._dlg) return;
      const { host, trigger } = this._dlg;
      document.removeEventListener('keydown', this._onKey, true);
      host.remove();
      this._dlg = null;
      if (restoreFocus && trigger && trigger.focus) trigger.focus();
    }
  }

  customElements.define('control-panel-card', ControlPanelCard);
  // Backwards-compatible alias so dashboards still using custom:toggle-info-card keep working.
  if (!customElements.get('toggle-info-card')) {
    customElements.define('toggle-info-card', class extends ControlPanelCard {});
  }
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: 'control-panel-card',
    name: 'Control Panel Card',
    description: 'List of settings (toggles, sliders, selects, times, buttons, values), each with a brief and a ? button that opens a longer description.',
    preview: false,
  });
  console.info(`%c CONTROL-PANEL-CARD %c v${VERSION} `, 'background:#03a9f4;color:#000', 'background:#222;color:#fff');
})();
