/*
 * Site configuration. Every field is optional: remove or comment out a field to use the built-in default.
 *
 * Options below are defaults for first-time visitors. Once a visitor changes an option on the page,
 * their own choice (kept in their browser) takes precedence.
 */
window.APP_CONFIG = {
  /* ---------- Branding ---------- */
  // title: 'Diff',                      // Heading shown on the page
  // pageTitle: 'Diff — duka.tr',         // Browser tab title
  // tagline: { en: '...', tr: '...' },  // Text next to the title (a string, or one string per language)
  // footer: { en: '...', tr: '...' },   // Footer text (a string, or one string per language)

  /* ---------- Appearance ---------- */
  // lang: 'en',                         // UI language: 'en' | 'tr'. Omit to follow the browser language
  // theme: 'dark',                      // 'light' | 'dark'. Omit to follow the OS setting

  /* ---------- Default options ---------- */
  format: 'text',                        // 'text' | 'json' | 'xml'
  whitespace: 'none',                    // 'none' | 'trim' (leading/trailing) | 'all'
  ignoreCase: false,
  turkishCase: false,                    // Turkish case rules when ignoring case (I↔ı, İ↔i)
  ignoreBlank: false,                    // Ignore blank lines
  inline: 'word',                        // Inline highlight: 'word' | 'char' | 'off'
  view: 'split',                         // 'split' (side by side) | 'unified'
  hide: false,                           // Hide unchanged lines
  context: 5,                            // Context lines kept around changes when hiding
  contextOptions: [0, 3, 5, 10, 20],     // Choices offered in the "Context" menu

  /* ---------- Diff engine limits ---------- */
  limits: {
    timeoutMs: 10000,                    // Line diff time budget; past it, the rest is shown as one block
    inlineTimeoutMs: 150,                // Time budget per changed line pair for inline highlighting
    maxInlineTokens: 5000,               // Lines longer than this (in words/characters) get no inline highlight
    inlineMinSimilarity: 0.3,            // Below this share of common text, a line pair is not highlighted inline
  },
};
