CJ CRUZ PERSONAL TRADE TRACKER — PREMIUM FIX PACKAGE

Included fixes:
- Calendar popup placement is clamped to the visible viewport and scrolls within the viewport on small screens.
- Gold/Silver calculation results popup is compact and follows the supplied lavender-glass reference.
- Existing Calculate Gold/Silver buttons retain their current purple gradient style and right alignment.
- Chart.js is no longer a render-blocking script on non-dashboard pages, reducing the chance of a blank/slow Calculations page when the CDN is slow. Dashboard still loads Chart.js deferred.
- Existing calculation formulas and localStorage logic were not intentionally changed.

Install/test:
1. Extract the ZIP to a new folder.
2. Open trade/calculations.html directly from that extracted folder.
3. Test calendar on Calculations, Market Snapshot, Deposits/Withdrawals, and FX → MCX Gap Mapper.
4. Compare Gold and Silver calculations against the reference Excel before live use.
5. If using file:// and the browser shows a blank page, confirm you opened this ZIP's trade/calculations.html, not a nested duplicate path.

This package has had static checks; real browser testing is still required. Keep your previous ZIP as a backup.
