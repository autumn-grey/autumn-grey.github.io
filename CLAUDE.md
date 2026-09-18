# autumn-grey.github.io

GitHub Pages root site for the `autumn-grey` org. Hosts "Autumn's Stonking Awesome Torn App", a browser tool for the game Torn. Live at https://autumn-grey.github.io/

## Generated files — do not edit directly

Four HTML pages are built from markdown by `build-docs.py`. Editing the HTML is pointless; the next build overwrites it. Edit the `.md` and rebuild.

| Source | Generated |
|---|---|
| `README.md` | `site-info.html` |
| `invLogic.md` | `invLogic.html` |
| `changelog.md` | `changelog.html` |
| `LICENCE.md` | `licence.html` |

`index.html` is the app itself. It is **not** generated — edit it directly.

## How the app is laid out

`index.html` holds the markup only. The styling is in `styles.css` and the
script is in `js/`, loaded in order as plain (non-module) scripts at the end of
the body, so they share one global scope exactly as the single inline script
did. Order matters: a file can call anything defined in a file above it, and
`js/boot.js` runs last because it starts the app.

| File | What's in it |
|---|---|
| `js/version.js` | `APP_VERSION` and `APP_UPDATED` |
| `js/data.js` | Stock table, benefit metadata, tags, game constants |
| `js/core.js` | Helpers, settings UI, localStorage, API fetching, user data |
| `js/investments.js` | Row builders, selection, undo/redo, recommendation, rendering |
| `js/planner.js` | Goal selection, the purchase simulation, the plan table |
| `js/export.js` | CSV export |
| `js/entry.js` | Refresh, sorting and the Investments page wiring |
| `js/banking.js` | Basic Banking |
| `js/pages.js` | Start-up, page switching, the top buttons and footer links |
| `js/feedback.js` | Feedback & Reporting form |
| `js/testing.js` | Testing feedback survey |
| `js/scripts-page.js` | Scripts page, including the GitHub save |
| `js/boot.js` | The four lines that start everything |

Two rules that come out of the files being separate requests. A call into
another file is guarded with `typeof fn==="function"`, because one file can fail
to load while the rest of the app is fine, and the guard keeps that to a page
that does not fill in rather than a half-switched page with no way back. Calls
within a file are not guarded. And a page is one entry in `PAGE_ELS` in
`js/pages.js`, which is also where the list of valid page names comes from.

Colours come from the variables at the top of `styles.css`. `--accent` is
whichever colour the section you are in uses: orange on Investments, Planner and
Basic Banking, aqua under `body.edujob` for Education & Job. `--orange` and
`--aqua` name the two fixed hues for the few places that need one regardless of
the section, and `--accent-hi` is the lit-up shade for hovers.

## scripts.json

The Scripts page's panel list. `index.html` fetches it at page open; the Scripts
page's edit mode writes it back through the GitHub contents API using a
fine-grained token the owner pastes into the page (kept in their browser's
localStorage, never in the repo).

An entry whose URL is a Greasy Fork one carries a `meta` block — name, version,
created, updated — read from `https://greasyfork.org/scripts/{id}.json`, which
is CORS-open. It is written at save time and re-read on every page open, so the
stored copy is a fallback for when Greasy Fork is unreachable, not the source of
truth. An empty `title` means the panel names itself from that block.

So this file gets committed from two places: by hand here, and by the live site.
Pull before editing it locally, or the site's next save hits a 409 and the change
has to be redone. Edits made in the page while no token is set are held in
localStorage as an unpublished draft, and the page says so.

## Build

```
py build-docs.py
```

Use `py`, not `python` or `python3`. Plain `python` hits the Microsoft Store alias on this machine and fails. Requires the `markdown` package (`py -m pip install markdown`).

Run it after editing any of the four `.md` files, before committing, so sources and built pages stay in step. The build is deterministic — if output changes when sources didn't, something is wrong.

Page styling and the shared nav/footer live in `build-docs.py` (`STYLE` and `TEMPLATE`), not in the generated HTML.

## Versioning and the changelog

**Every push gets a version bump and a changelog entry. No exceptions** — if it
is worth publishing it is worth a line saying what changed. A push publishes, so
the changelog is what ties a live build to what is in it, and a bug report
carries the version.

- A new section or feature is a **minor** bump: `0.12.0`.
- Everything after it — fixes, tweaks, follow-ups — is a **patch** bump:
  `0.12.1`, `0.12.2`, and so on.

The version string lives in four places, and they must agree:

| File | What to change |
|---|---|
| `js/version.js` | `APP_VERSION` and `APP_UPDATED` |
| `changelog.md` | the `_Reference for …_` line, plus a new `### vX.Y.Z — YYYY-MM-DD` entry at the top of **Released** |
| `README.md` | the `_Reference for …_` line |
| `invLogic.md` | the `_Reference for …_` line |

Then run the build, so the generated pages carry the new version too.

Changelog entries are written for the person using the app, not the person who
wrote it: what changed and what it means for them, not which functions moved.
Newest first.

## Deploying

`main` is the published branch. Pushing to it updates the live site within about a minute. `.nojekyll` is present, so files are served as-is with no Jekyll processing.

Confirm before pushing — every push publishes, and every push needs its version bump and changelog entry first.
