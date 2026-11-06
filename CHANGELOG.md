# Changelog

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
