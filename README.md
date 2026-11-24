<p align="center">
  <img src="public/favicon.svg" alt="DUKA Diff logo" width="96" height="96">
</p>

<h1 align="center">DUKA Diff</h1>

**Private text, JSON and XML diff that runs entirely in your browser.**

Paste two texts or drop two files and see what changed — side by side or unified, with word- or character-level
highlights. The comparison runs in a Web Worker on your device; your text is never uploaded, stored or logged.

No accounts, no cookies, no analytics, no build step and no dependencies: just a handful of static files.

**Live:** [duka.tr/diff](https://duka.tr/diff/)

---

## Features

- **Split and unified views** — side by side or a single column, with line numbers on both sides.
- **Inline highlights** — changed words or characters are marked inside modified lines (or turn it off).
- **Structural JSON and XML** — key/attribute order and indentation are ignored, so only real data changes show up.
  Array and element order are kept, and JSON numbers are compared exactly as written (`1.50` ≠ `1.5`, and large
  integers are never rounded). Invalid input is reported with the side, line and column.
- **Ignore rules** — leading/trailing or all whitespace, letter case, blank lines. CRLF vs LF is always ignored.
- **Turkish case rules** — optional `I↔ı`, `İ↔i` folding when ignoring case (`SATIR` = `satır`, `kır` ≠ `kir`).
- **Focus on changes** — hide unchanged lines with 0–20 lines of context; click a hidden block to expand it.
- **Keyboard friendly** — `Ctrl+Enter` (`⌘+Enter`) to compare, `Alt+↓` / `Alt+↑` to jump between changes.
- **Files** — open or drag and drop files; they are read locally by the browser.
- **English and Turkish UI** — picked from your browser language, switchable any time. Light and dark themes.
- **Fast** — Myers' O(ND) diff in linear memory; typical 10,000-line files compare in tens of milliseconds.

## Privacy

Privacy is enforced by the browser, not just promised:

- All processing happens client-side, in a Web Worker. There is no backend.
- The page ships a strict Content Security Policy with `connect-src 'none'`, so it **cannot** make network requests,
  even by accident.
- Only your preferences (language, theme, options) are kept in `localStorage`. The texts you compare are never stored.
- No cookies, no analytics, no third-party scripts, fonts or CDNs.

The site is hosted on GitHub Pages, which, like any web server, keeps its own access logs (IP address, etc.).
Your text never appears in them because it is never sent.

## How it works

```
Text A ─┐
        ├─> Normalize ─> Line diff ─> Inline diff ─> Render
Text B ─┘   JSON/XML,     Myers,       words or       table, stats,
            ignore rules  Web Worker   characters     navigation
```

1. **Normalize** — for JSON/XML, both texts are converted to a canonical form ([format.js](public/format.js)).
   Ignore rules (whitespace, case, blank lines) are applied to the comparison keys, not to the displayed text.
2. **Line diff** — lines are interned to integers and diffed with Myers' algorithm using the linear-space
   "middle snake" bisection ([diff.js](public/diff.js)), off the main thread ([worker.js](public/worker.js)).
3. **Inline diff** — adjacent removed/added lines are paired and diffed again at word or character level. Pairs that
   share too little text are left unhighlighted, which reads better than a confetti of tiny changes.
4. **Render** — the UI ([app.js](public/app.js)) builds the table, collapses unchanged runs and tracks change blocks
   for navigation.

## Configuration

Site-wide defaults live in [`public/config.js`](public/config.js). Every field is optional; once a visitor changes an
option on the page, their own choice wins.

| Field | Default | Description |
|---|---|---|
| `title` | `DUKA Diff` | Page and tab title |
| `tagline` | per language | Text next to the title. A string, or `{ en: '…', tr: '…' }` |
| `footer` | per language | Footer text. A string, or `{ en: '…', tr: '…' }` |
| `lang` | browser language | UI language: `en` or `tr`. Falls back to `en` |
| `theme` | OS setting | `light` or `dark` |
| `format` | `text` | `text`, `json` or `xml` |
| `whitespace` | `none` | `none`, `trim` (leading/trailing) or `all` |
| `ignoreCase` | `false` | Ignore letter case |
| `turkishCase` | `false` | Turkish case rules when ignoring case |
| `ignoreBlank` | `false` | Ignore blank lines |
| `inline` | `word` | Inline highlight: `word`, `char` or `off` |
| `view` | `split` | `split` or `unified` |
| `hide` | `false` | Hide unchanged lines |
| `context` | `5` | Context lines kept around changes when hiding |
| `contextOptions` | `[0, 3, 5, 10, 20]` | Choices in the "Context" menu |
| `limits.timeoutMs` | `10000` | Time budget for the line diff; past it, the rest is shown as one change block |
| `limits.inlineTimeoutMs` | `150` | Time budget per line pair for inline highlighting |
| `limits.maxInlineTokens` | `5000` | Lines with more words/characters than this get no inline highlight |
| `limits.inlineMinSimilarity` | `0.3` | Minimum share of common text for a line pair to be highlighted inline |

Invalid values are ignored and the built-in default is used.

## Running locally

There is nothing to build. Serve the `public/` folder with any static file server, for example:

```bash
npx serve public
# or
cd public && python3 -m http.server 8000
```

Opening `index.html` straight from disk (`file://`) does not work, because browsers block Web Workers there.

## Deployment

Every push to `main` runs [.github/workflows/pages.yml](.github/workflows/pages.yml): it runs the tests, then
publishes `public/` to GitHub Pages. Pull requests run the tests only.

During deployment, the `__V__` placeholder in asset URLs is replaced with the commit id, so browsers pick up new
files right after an update instead of serving stale ones from cache.

To host your own copy, fork the repository, enable **Settings → Pages → Source: GitHub Actions**, and update the
`canonical` link in [index.html](public/index.html) and the branding in [config.js](public/config.js).

## Tests

Requires Node.js 18 or later:

```bash
node --test tests/diff.test.js
```

The suite checks the diff engine against a brute-force LCS on thousands of random inputs, covers the ignore rules,
Turkish case folding and JSON normalization, and includes a 10,000-line performance check.

## Project structure

```
public/              Static site (no build step, no dependencies)
  index.html         Page markup and Content Security Policy
  config.js          Site configuration
  i18n.js            UI strings (English, Turkish)
  app.js             UI: options, rendering, navigation
  worker.js          Runs the diff off the main thread
  diff.js            Diff engine (Myers O(ND), linear memory)
  format.js          JSON/XML normalization
  style.css          Styles (light/dark themes)
  favicon.svg        Icon
tests/               Diff engine and JSON normalization tests
.github/workflows/   Tests and GitHub Pages deployment
```

## Localization

1. Add a new entry to [`public/i18n.js`](public/i18n.js) (for example `de: { … }`), copying the keys from `en`.
2. That's it — the language switcher and browser-language detection pick it up automatically.
   Missing keys fall back to English.

Translations are welcome as pull requests.

## Contributing

Bug reports and ideas: [open an issue](https://github.com/duka-tr/diff/issues). Pull requests are welcome; please
keep the project dependency-free and run the tests before submitting.

## License

DUKA Diff is licensed under the [Apache License 2.0](LICENSE). Copyright 2026 duka.tr.

The diff engine implements Eugene W. Myers, *"An O(ND) Difference Algorithm and Its Variations"* (1986). Its
bisection step is adapted from [diff-match-patch](https://github.com/google/diff-match-patch) (Apache License 2.0).
