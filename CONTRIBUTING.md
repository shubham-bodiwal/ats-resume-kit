# Contributing to ats-resume-kit

Thanks for taking the time. Bug reports, fixes and small focused features are all welcome.

## Before you start

- For a bug, open an issue with steps to reproduce first, unless the fix is a one-liner.
- For a feature, open an issue to discuss it before writing code. The project stays small on purpose, so some ideas fit better in your own app.
- By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Setup

You need Node.js (see `engines` in `package.json`) and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/shubham-bodiwal/ats-resume-kit.git
cd ats-resume-kit
pnpm install
pnpm dev            # web page at http://localhost:5173
```

This repo covers the library and CLI (`src/`) and the in-browser page (`web/`).

## Making a change

1. Branch from `main`.
2. Keep the change focused: one fix or feature per pull request.
3. Add or update tests. Tests live in `test/` (Vitest). Matcher changes need a test with a short job-description snippet; renderer changes need a test that reads the PDF text back.
4. Update the README if behaviour or options change, and add a line under **Unreleased** in [CHANGELOG.md](CHANGELOG.md).
5. Run the full set of checks. They must pass with no errors or warnings:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm build:web
```

There is no CI; these local checks are the gate.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org): `fix: ...`, `feat: ...`, `docs: ...`, `test: ...`, `chore: ...`. Write the subject in the imperative and keep it under 72 characters.

## Code style

- TypeScript in strict mode, no `any` unless a comment says why.
- Lint with [Biome](https://biomejs.dev) (`pnpm lint`). Suppress a rule only on the line that needs it, with a reason.
- Prefer small functions and plain data over new abstractions or dependencies.

## Reporting security issues

Please don't open a public issue. See [SECURITY.md](SECURITY.md).
