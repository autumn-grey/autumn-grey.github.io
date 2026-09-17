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

## scripts.json

The Scripts page's panel list. `index.html` fetches it at page open; the Scripts
page's edit mode writes it back through the GitHub contents API using a
fine-grained token the owner pastes into the page (kept in their browser's
localStorage, never in the repo).

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
| `index.html` | `APP_VERSION` and `APP_UPDATED` (near the top of the script) |
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
