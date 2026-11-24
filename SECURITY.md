# Security policy

Diff promises that the text you compare never leaves your browser. Anything that breaks that promise is treated as a
security issue, for example:

- a way for the page to send text, files or other data to any server;
- a bypass of the Content Security Policy in [`public/index.html`](public/index.html);
- script injection (XSS) through compared text, file names, JSON/XML input or configuration;
- text being stored in the browser (only preferences such as language, theme and options should be).

## Supported versions

Only the live site at [duka.tr/diff](https://duka.tr/diff/), built from the latest commit on `main`, is supported.

## Reporting a vulnerability

Please **do not open a public issue** for security problems. Report them privately instead:

- through GitHub's [private vulnerability reporting](https://github.com/duka-tr/diff/security/advisories/new), or
- by email to [support@duka.tr](mailto:support@duka.tr).

Include the steps to reproduce, the browser and version you used, and the impact you expect. You will get a reply
within a few days. Once a fix is published, you will be credited in the advisory unless you prefer otherwise.
