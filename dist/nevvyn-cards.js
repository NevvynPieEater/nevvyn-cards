/**
 * nevvyn-cards.js - loader for the Nevvyn Cards bundle (control-panel-card, victron-ess-card, sun-day-card).
 *
 * This is the only file registered as a dashboard resource (type: module). It loads the three card
 * files that sit next to it, and it makes sure a browser never runs a stale copy of them:
 *
 *  - Installed through the Marketplace: the resource URL for this file carries a version parameter
 *    (?v=...) that changes on every update. The loader passes that same parameter on to each card
 *    file, so one update refreshes all four files at once, with no cache clearing.
 *  - Files copied in by hand (no parameter): the loader asks the server for each card's
 *    Last-Modified time on every page load and uses it as the cache key, so a replaced file is
 *    picked up on the next page load without any version number.
 *
 * Resource URL (the Marketplace adds it for you):
 *   /local/community/nevvyn-cards/nevvyn-cards.js     type: module
 */
const FILES = ['control-panel-card.js', 'victron-ess-card.js', 'sun-day-card.js'];

const self = new URL(import.meta.url);
const base = new URL('./', self);

async function cacheKey(file) {
  // Installed through the Marketplace: reuse the version parameter on this file's own URL.
  if (self.search) return self.search;
  // Copied in by hand: key on the file's Last-Modified time (revalidated each load).
  try {
    const res = await fetch(new URL(file, base), { method: 'HEAD', cache: 'no-cache' });
    const stamp = Date.parse(res.headers.get('last-modified') || '') || 0;
    if (stamp) return `?m=${stamp}`;
  } catch (e) { /* fall through */ }
  return `?t=${Math.floor(Date.now() / 60000)}`; // last resort: at most a minute old
}

const results = await Promise.allSettled(
  FILES.map(async (file) => {
    const url = new URL(file, base);
    url.search = await cacheKey(file);
    await import(url.href);
    return file;
  })
);

const failed = results
  .map((r, i) => (r.status === 'rejected' ? `${FILES[i]}: ${r.reason && r.reason.message ? r.reason.message : r.reason}` : null))
  .filter(Boolean);
if (failed.length) console.error('nevvyn-cards: could not load', failed);
else console.info('%c NEVVYN-CARDS %c loaded ' + FILES.length + ' cards ', 'background:#f2a43a;color:#000', 'background:#222;color:#fff');
