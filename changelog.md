# Changelog

_Reference for [autumn-grey.github.io](https://autumn-grey.github.io) · v0.8.0 · Updated: 2026-09-04_

Newest first. Version numbers follow [semantic versioning](https://semver.org):
`MAJOR.MINOR.PATCH`. Still on `0.x` because the app isn't deployment-ready
until it has a real access layer.

---

## Released

### v0.8.0 — 2026-09-04

- **Scripts** and **Education & Job Planner** added to the footer links. Both are
  placeholders for now.
- The Prototype banner reads as one paragraph: the arrow and **Prototype:** now
  start the text rather than sitting above it as a heading. Collapsed, it still
  reads **Prototype Warning**. Its wording is rewritten, and it links straight to
  a feedback form or an incident form with the right type already chosen.
- Terms of Service: a paragraph on how feedback and incident reports are handled,
  and the data table reworded.
- The report title is generated, so it is shown as a heading rather than sitting
  in an editable box.
- The body limit is 1800 characters, which is what a 2000 character Discord
  message leaves once the longest possible title and related-to line are taken
  out. The whole form travels in the message again rather than in an embed.

### v0.7.1 — 2026-09-04

- The report body is capped at 1900 characters. A count appears in the bottom
  right of the box once you pass 1700, turns red at the cap, and typing past it
  shakes the box and flashes its outline red.
- The body now travels in the message's embed rather than its content. A full
  1900 character body plus the title and the related-to line went over Discord's
  2000 character message limit and would have been silently truncated.
- Back to Stonking and OK match the Refresh market data only button; Submit form
  matches Refresh all API data.

### v0.7.0 — 2026-09-04

- **Feedback & Reporting**, a new page on the end of the footer links.
  - Two types: Feedback, Suggestions & Questions, or Report a Problem.
  - The title fills itself in as `INC - version - timestamp UTC - Name [ID]`, or
    `FSQ` for the other type, and keeps the timestamp current until you edit it.
  - Reporting a problem asks what it relates to and attaches the logs that suit
    the answer: the error log always, plus the API report, a planner state file,
    an investments state file, or all of them for Other. The state files are the
    same TSV as the download button plus every setting that shaped the numbers.
  - Submitting posts to a Discord channel. The status line names every file that
    went and, in red, every one that could not be pulled and why. If any of it
    failed, a copy button takes the whole form and the status, and a link opens
    a Torn message to AutumnGrey.
  - **Your API key is never attached, and every file and the message itself are
    swept for it before anything is sent.**
- The Terms of Service data table now says a submitted report leaves the browser,
  which it did not before because nothing ever left it.

### v0.6.1 — 2026-09-03

- The footer's second and third lines are rewritten, and it now states that
  Autumn's Tools are not affiliated with Torn Ltd.
- Investments and Planner are two separate buttons rather than one that toggles,
  both always visible, with the page you are on filled in. Order is the
  Basic/Advanced switch, Investments, Planner, so nothing moves when the switch
  hides on the Planner page.
- Jump to top is a tab on the right edge reading bottom to top, and it stops
  above the footer instead of floating over it. Gone from the Terms of Service.
- A copy button on the API results panel, in its top right corner while the panel
  is open. Copies the report, the diagnostics, anything in the problem log, and
  the version.

### v0.6.0 — 2026-09-03

First build handed out for user testing.

- The title is now a button. From Docs or the Terms of Service it returns you to
  the page and view you were last on. On a working page it does nothing.
- Docs links are a row of equal tiles that wrap onto further rows as the screen
  narrows, instead of a stack of full-width cards.
- **OK** on the Docs page is now **Back to Stonking**.
- Three more videos in the rotation, twenty-two in all.
- **Fixed:** saving settings threw and reported nothing when the browser refused
  to write to storage, which is what happens in private mode or when storage is
  full. Every write is now guarded and the status line says so.
- **Fixed:** clearing saved settings left the pins set, so the pin buttons still
  looked pinned and the next save wrote them straight back.
- **Fixed:** the Advanced button was marked active in the markup while the app
  actually opens in Basic. Basic is the default; the markup now agrees.
- Corrected the wording on the clear-settings message, which claimed nothing on
  screen changed when row marks and pins do.

Checked and left alone: every path builds without error and with no double-buys,
no unreachable-day arithmetic errors and no plan-order regressions; the table
sorts on every column; both exports write; no horizontal scroll and no sub-16px
inputs at 360, 414 or 768 px on any of the four pages; browser back and forward
across every page; localStorage keys all written, read and cleared consistently.
The merge rule stays as it is for testing.

### v0.5.10 — 2026-09-03

- Added **A Beautiful Secret** to the Docs page. Every click opens a different
  video, picked at random from nineteen.
- Dropped the blurbs from the other Docs cards and the subtitle from the Docs
  heading.

### v0.5.9 — 2026-09-03

- Renamed the Planner Logic page to **Investment Logic**, published as
  `invLogic.html`. `planner-logic.html` is now dead and can be deleted.
- Editing pass over both docs: removed filler wording.

### v0.5.8 — 2026-09-03

Documentation only; the app's behaviour is unchanged.

- Merged the two competing drafts of each doc into one. The logic explainer's
  source is now `invLogic.md`, rebuilt
  from the fuller draft: benefit-by-benefit valuation with worked examples, the
  banks and Private Islands as their own sections, the increment-visibility
  rule, the job point algebra derived rather than asserted, a symbol and
  constant reference, and an "In the code" note under most sections.
- Kept from the previous version: the pinning rules, the acquire and parking
  pseudocode, the closing moves, the Cayman-not-City-Bank warning, and the full
  list of what the model ignores.
- **Corrected:** the 100-year horizon does not truncate a plan. An unreachable
  target is stepped over and the plan continues; only the 2,000-step limit ends
  one early. One draft had both ceilings truncating.
- **Corrected:** the two priority lists are now documented as the separate
  controls they are. *Prioritise* on the Investments page changes that table's
  sort order only; *Situational Stocks* on the Planner page is the one the plan
  obeys. One draft had merged them into a single control.
- Fixed a cross-reference pointing at the wrong section, and a bank APR formula
  that omitted the Oil Mogul multiplier its own constants table listed.
- README rebuilt around the same split: the user-facing guide keeps the whole
  page, and the code-level material (file layout, the row object, data sources,
  local storage) moved into the logic explainer's appendix, where the rest of
  the implementation notes already live.
- Added a "Reporting a bug" section, a keyboard reference, a tag key, the API
  key selection table, and an honest note that the faction gate runs in the
  browser and is not real access control.

### v0.5.7 — 2026-09-03

- The Private Yacht is no longer optional. A Private Island is costed fully
  upgraded everywhere, the yacht included, so the tickbox in Miscellaneous
  Stuff is gone along with its saved setting. Its slot now shows the upgrade
  cost and the saving from ELT and Interior Connections as a plain readout.
- `piUpgradeBase()` is retired; every caller uses `PI_UPGRADE_TOTAL` directly.

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

### Scripts

- A script for following the investment planner within the Torn environment.
- A script to block users from travelling if they'll miss their OC start time.
- A script that lets chats open and minimise independently in different windows.
- A script to add chat reactions visible to anyone who also has the script.
