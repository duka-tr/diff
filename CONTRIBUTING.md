# Contributing

Thanks for your interest in improving Diff. Bug reports, ideas, translations and pull requests are all welcome.

## Reporting bugs and ideas

Open an [issue](https://github.com/duka-tr/diff/issues). For a bug, include the browser and version, the steps to
reproduce, and if possible a small pair of texts that shows the problem. Please remove anything private from them
first.

Security problems should be reported privately; see [SECURITY.md](SECURITY.md).

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change and try it in a browser (see [Running locally](README.md#running-locally)).
3. Run the tests (Node.js 18 or later):

   ```bash
   node --test tests/diff.test.js
   ```

4. Open a pull request describing what changed and why. Tests run automatically on every pull request.

Small, focused pull requests are easier to review. For a larger change, please open an issue first to discuss it.

## Ground rules

These keep the project small and its privacy promise verifiable:

- **No dependencies and no build step.** The site is plain HTML, CSS and JavaScript served as-is from `public/`.
- **No network access.** The page must keep working under the Content Security Policy in `public/index.html`
  (`connect-src 'none'`). Do not add external scripts, fonts, CDNs or analytics.
- **Never store the compared text.** Only preferences may be kept in `localStorage`.
- **Add tests** for changes to the diff engine (`public/diff.js`) or JSON/XML normalization (`public/format.js`).
- **User-facing text goes in `public/i18n.js`**, with entries for every language.

## Translations

To add a language, add a new entry to [`public/i18n.js`](public/i18n.js) with the same keys as `en`. It appears in
the language switcher and in browser-language detection automatically. See [Localization](README.md#localization).

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
