# Contributing

Thanks for contributing to **Togalma CLI**.

## Development

Prerequisites:

- Node.js 18+

Install dependencies:

```bash
npm ci
```

Run locally (no build):

```bash
npm run dev -- menu
```

Lint / typecheck:

```bash
npm run lint
npm run typecheck
```

Build:

```bash
npm run build
npm start -- menu
```

## Pull requests

- Keep PRs focused and small when possible.
- Avoid committing secrets (`.env`, API tokens, session files).
- If you change user-facing behavior, update `README.md`.

