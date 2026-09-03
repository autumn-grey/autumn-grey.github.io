# Changelog

_Reference for [autumn-grey.github.io](https://autumn-grey.github.io) · v0.5.6 · Updated: 2026-09-03_

Newest first. Version numbers follow [semantic versioning](https://semver.org):
`MAJOR.MINOR.PATCH`. Still on `0.x` because the app isn't deployment-ready
until it has a real access layer.

---

## Released

### v0.5.6 — 2026-09-03

- Added a changelog, with a roadmap of what's planned next.
- Added Changelog and Licence links to the Docs page.
- Rewrote the opening of the Site Info page, which still described the app as a
  file you pass around rather than a hosted site.
- Pointed the cross-references in Site Info and the licence at the published
  Planner Logic page instead of the markdown source.

### v0.5.5 — 2026-09-03

- Reordered the footer links to Go to Torn, Docs, Terms of Service.
- Added version and updated date to the heading of both doc pages.

### v0.5.4 — 2026-09-03

- Renamed the footer's Torn link to "Go to Torn".

### v0.5.3 — 2026-09-03

- Added a link to Torn in the footer link row.

### v0.5.2 — 2026-09-03

- Added the Docs page, linking out to Site Info and Planner Logic as standalone
  HTML pages built from the markdown sources.
- Added a licence file.

### v0.5.1 — 2026-09-03

- Dropped back from 1.0 to 0.5. The app isn't deployment-ready without a
  working access layer, and the version number was claiming otherwise.
- Switched to unpadded semantic versioning.

### v0.5.0 — 2026-09-03

Up on GitHub and ready to share for testing.

- Terms of Service page, footer, and Kudos.
- Undo and redo (Ctrl+Z, Ctrl+Shift+Z) for row and step marks.
- Job point specials: Oil Mogul on bank terms, Healthy Mind and Cutting Corners
  on education, Interior Connections on property upgrades.
- Company detection by Torn's `company_type` ids rather than company name, so
  a renamed company still resolves.
- Racing history check to decide whether TCM is worth planning for.
- Staff exception to the faction gate.
- A debug log panel that stays hidden until something actually fails.

### v0.4 — Integration

- Investments and Planner joined into one app with shared settings.
- Footer and Terms of Service.

### v0.3 — The planner

- Day-by-day purchase simulation, buy order, parking, and the Path options.

### v0.2 — Basic view

- Simplified mobile-friendly view alongside the full table.

### v0.1 — Initial build

- Advanced investments table, benefit valuation, and ROI ranking.

---

## Roadmap

Planned, in no particular order.

- **Complete UI visual design overhaul** for max 𝒶𝑒𝓈𝓉𝒽𝑒𝓉𝒾𝒸 and ｆｕｎｃｔｉｏｎａｌ.
- **Separating into a proper multi-page website** rather than one HTML file
  switching pseudo-pages.
- **A functional, secure access layer.** The current faction check runs in the
  browser and can be edited out. Until that changes the app is not ready to
  deploy.
- **v2: the jobs and education guide.**
