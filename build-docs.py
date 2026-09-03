#!/usr/bin/env python3
"""Turn the markdown docs into standalone HTML pages for GitHub Pages.

Re-run after editing either .md file:

    python3 build-docs.py

Mermaid blocks are rendered by mermaid.js when online, and fall back to the
readable source text when not, so the file still works opened locally.
"""
import re, markdown

PAGES = [
    ("README.md",         "site-info.html",      "Site Info"),
    ("invLogic.md",       "invLogic.html",       "Investment Logic"),
    ("changelog.md",      "changelog.html",      "Changelog"),
    ("LICENCE.md",        "licence.html",        "Licence"),
]

STYLE = """
:root{--bg:#111315;--panel:#191c20;--panel2:#20242a;--line:#30363d;
      --text:#e8eaed;--muted:#9aa3ad;--accent:#e39b45;--good:#59c37a;--bad:#e06c75}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);line-height:1.65;
     font:15px/1.65 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.wrap{max-width:860px;margin:0 auto;padding:28px 20px 60px}
.topbar{display:flex;flex-wrap:wrap;gap:14px;align-items:center;
        padding-bottom:14px;margin-bottom:26px;border-bottom:1px solid var(--line)}
.topbar a{color:var(--accent);text-decoration:underline}
.topbar .sep{color:var(--muted)}
h1,h2,h3{line-height:1.25}
h1{font-size:26px;margin:0 0 6px}
h2{font-size:20px;margin:34px 0 10px;padding-top:14px;border-top:1px solid var(--line)}
h3{font-size:16px;margin:22px 0 8px}
a{color:var(--accent);text-decoration:underline}
a:hover{filter:brightness(1.15)}
p,li{color:var(--text)}
code{background:var(--panel2);border:1px solid var(--line);border-radius:4px;
     padding:1px 5px;font-size:12.5px;
     font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
pre{background:var(--panel);border:1px solid var(--line);border-radius:8px;
    padding:12px 14px;overflow-x:auto}
pre code{background:none;border:0;padding:0;font-size:12.5px;line-height:1.55}
table{border-collapse:collapse;width:100%;margin:14px 0;font-size:13px}
th,td{border:1px solid var(--muted);padding:8px 10px;text-align:left;vertical-align:top}
th{font-weight:700}
blockquote{margin:14px 0;padding:2px 0 2px 14px;border-left:3px solid var(--line);
           color:var(--muted)}
details{background:var(--panel);border:1px solid var(--line);border-radius:8px;
        padding:10px 14px;margin:16px 0}
details[open]{padding-bottom:4px}
summary{cursor:pointer;color:var(--muted);font-size:13px}
summary:hover{color:var(--text)}
details>*:not(summary){font-size:13.5px}
h2[id],h3[id]{scroll-margin-top:12px}
hr{border:0;border-top:1px solid var(--line);margin:26px 0}
.mermaid{background:var(--panel);border:1px solid var(--line);border-radius:8px;
         padding:12px 14px;overflow-x:auto;white-space:pre;
         font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px}
footer{margin-top:40px;padding-top:14px;border-top:1px solid var(--line);
       color:var(--muted);font-size:12px;text-align:center}
@media(max-width:640px){.wrap{padding:20px 14px 44px}h1{font-size:22px}}
"""

TEMPLATE = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} · Autumn's Stonking Awesome Torn App</title>
<style>{style}</style>
</head>
<body>
<div class="wrap">
  <nav class="topbar">
    <a href="index.html">&larr; Back to the app</a>
    <span class="sep">|</span>
    <a href="site-info.html">Site Info</a>
    <span class="sep">|</span>
    <a href="invLogic.html">Investment Logic</a>
    <span class="sep">|</span>
    <a href="changelog.html">Changelog</a>
    <span class="sep">|</span>
    <a href="licence.html">Licence</a>
  </nav>
{body}
  <footer>Autumn's Stonking Awesome Torn App &middot;
    <a href="https://www.torn.com/profiles.php?XID=4386333" target="_blank" rel="noopener noreferrer">AutumnGrey</a>
  </footer>
</div>
{mermaid}
</body>
</html>
"""

MERMAID_TAG = """<script type="module">
  // Rendered when online; the source stays readable if this never loads.
  import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
  mermaid.initialize({startOnLoad:true,theme:"dark"});
</script>
"""


def convert(src_path, out_path, title):
    text = open(src_path, encoding="utf-8").read()

    # Pull mermaid blocks out before conversion so they aren't escaped as code.
    blocks = []
    def stash(m):
        blocks.append(m.group(1))
        return f"\n\nMERMAIDPLACEHOLDER{len(blocks)-1}\n\n"
    text = re.sub(r"```mermaid\n(.*?)```", stash, text, flags=re.S)

    html = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "sane_lists", "attr_list",
                    "md_in_html", "toc"],
        extension_configs={"toc": {"permalink": False}},
    )

    for i, code in enumerate(blocks):
        html = html.replace(
            f"<p>MERMAIDPLACEHOLDER{i}</p>",
            f'<pre class="mermaid">{code.strip()}</pre>',
        )

    # Links between the two docs should point at the built pages, not the source.
    html = html.replace('href="invLogic.md"', 'href="invLogic.html"')
    html = html.replace('href="README.md"', 'href="site-info.html"')
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)

    out = TEMPLATE.format(
        title=title, style=STYLE, body=html,
        mermaid=MERMAID_TAG if blocks else "",
    )
    open(out_path, "w", encoding="utf-8").write(out)
    print(f"{src_path} -> {out_path}  ({len(out):,} bytes, {len(blocks)} mermaid)")


for src, out, title in PAGES:
    convert(src, out, title)
