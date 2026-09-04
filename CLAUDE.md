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

## Build

```
py build-docs.py
```

Use `py`, not `python` or `python3`. Plain `python` hits the Microsoft Store alias on this machine and fails. Requires the `markdown` package (`py -m pip install markdown`).

Run it after editing any of the four `.md` files, before committing, so sources and built pages stay in step. The build is deterministic — if output changes when sources didn't, something is wrong.

Page styling and the shared nav/footer live in `build-docs.py` (`STYLE` and `TEMPLATE`), not in the generated HTML.

## Deploying

`main` is the published branch. Pushing to it updates the live site within about a minute. `.nojekyll` is present, so files are served as-is with no Jekyll processing.

Confirm before pushing — every push publishes.
