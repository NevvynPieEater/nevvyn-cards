# Changelog

## 1.4.0

- Packaging: the three cards are now built into one file, `dist/nevvyn-cards.js` (sources in `src/`, built by
  `node scripts/build.mjs`). The Marketplace and HACS only download the file named in `hacs.json`, so the
  separate card files and the loader never reached the install. One file also means one versioned URL, so an
  update refreshes all three cards at once.

- `sun-day-card.js` 1.3.0: the chart now draws the whole day and night as one curve on a fixed, symmetric
  scale (the horizon is the middle line), so a higher sun is always taller and a low winter sun is no longer
  a flat line with a bump.
- New moon track: dashed moon elevation curve with a phase-shaded moon at the current time (`moon: false`
  hides it, `colors.moon` / `--sdc-moon` recolour it). Computed in the browser, no entity needed.
- Weather on the sun and moon: set `weather_entity` (and optionally `cloud_entity`) and the body dims and is
  covered by clouds, with rain, snow, fog or lightning drawn to match. `weather: false` turns it off, or give
  an on/off entity (`weather: input_boolean.xxx`) to switch it live.

## 1.0.0

First bundled release.

- `nevvyn-cards.js` loader: the only dashboard resource. Loads the three cards and keeps browsers
  from running stale copies (uses the Marketplace version parameter, or the files' Last-Modified
  time when copied in by hand).
- `control-panel-card.js` 2.1.0 - settings list with brief + "?" description (toggles, sliders,
  selects, times, buttons, read-only values); dark, light and LCARS styles.
- `victron-ess-card.js` - animated Victron ESS power flow and controls; dark, light and LCARS styles.
- `sun-day-card.js` 1.1.0 - new. Sunrise / sunset / dawn / dusk on a live elevation curve, with a
  simple and an advanced variant (daylight length, golden hour, live position, solar array
  potential vs output). Sizing and styling options: `font_scale`, `chart_height`, `sun_size`,
  `fit`, `show`, `colors`, plus `--sdc-*` CSS variables.
