# Releasing / Publishing

This repository publishes the npm package **`@togalma/cli`**.

## Prerequisites

- You must have npm access to the **`@togalma`** scope (org membership) or a granular token with publish permission.
- 2FA may be required for publishing.

## Version bump

Update `package.json` version (semver).

```bash
npm version minor
```

Or manually edit `package.json` and commit.

## Build & test locally

```bash
npm ci
npm run lint
npm run typecheck
npm run build
node dist/cli.js --help
```

## Publish

```bash
npm publish --access public
```

If npm asks for OTP, provide it.

## Verify package contents

```bash
npm pack --dry-run
```

Ensure only expected artifacts are included (primarily `dist/`, `bin/`, `assets/`, `README.md`).

