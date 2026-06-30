# AGENTS.md

Guidance for AI agents (and humans) working in this repo. Verified against `package.json`, `tsconfig.json`, the `.github/workflows`, and `.vscode/` configs.

## What this is

VS Code extension (`vscode-groovy-lint`) that lints, formats, and auto-fixes Groovy / Jenkinsfile via `npm-groovy-lint` (CodeNarc). Language Server Protocol architecture:

- `client/src/` — extension entrypoint (`extension.ts`), VS Code integration, tests. The published extension `main` is `./client/out/extension`.
- `server/src/` — LSP server (`server.ts`), runs `npm-groovy-lint`. Spawned by the client over IPC. `npm-groovy-lint` requires Java at runtime (`find-java-home` is used).
- Root `package.json` orchestrates scripts across both packages; `client/` and `server/` have their own `package.json` + `tsconfig.json` compiled via `tsc -b`.
- Build output (`client/out`, `server/out`) is gitignored and required at runtime — compile before running/debugging anything.

## Developer commands

Run from repo root:

| Task | Command |
| --- | --- |
| Install (root + client + server) | `npm install` (runs `postinstall`: `npm ci` in both subpackages) |
| Compile TS (project references) | `npm run compile` |
| Watch | `npm run watch` |
| Lint | `npm run lint` |
| Lint + autofix | `npm run lint:fix` |
| Tests (VS Code extension tests) | `npm test` |
| Tests with coverage | `npm run test:coverage` |
| Verbose/debug test runs | `npm run test:verbose` / `npm run test:debug` |

Important order and gotchas:

- `pretest` runs `compile` then `lint`. `npm test` triggers `pretest`, so it always rebuilds + lints first.
- `test` runs `node ./client/out/test/runTest.js`, which downloads a real VS Code via `@vscode/test-electron` and runs integration tests in it. `VSCODE_EXECUTABLE_PATH` can override the VS Code binary (used in the VSCodium CI job). Headless/CI runs must wrap with a virtual framebuffer (CI uses `GabrielBB/xvfb-action`).
- `ts-node`/`mocha` direct script exists (`npm run mocha`) but is **not** the canonical test path — the `test` script is. Use `mocha` only for quick non-VS-Code checks.
- `dev:pre-commit` runs `lint:fix` + `compile` **and copies `README.md` over `docs/index.md`**. If you edit docs, edit `README.md` (it is the source). The `Update check` CI workflow asserts `dev:pre-commit` produces a clean tree — never commit changes that leave `docs/index.md` out of sync with `README.md`.
- `vscode:prepublish` calls `dev:pre-commit`; releasing is triggered by GitHub release creation (`deploy-RELEASE.yml`), publishing to both VS Code Marketplace and Open VSX.

## Requirements

- Node `>=22.0.0`, VS Code `>=1.75.0`. CI matrix tests Node 22 and 24 on Ubuntu/macOS/Windows.
- Java must be on `PATH` (or configured via `groovyLint.java.executable`) for the linter to actually work — tests that exercise linting will fail without it.

## Code style / conventions

- ESLint config is minimal (`curly`, `eqeqeq`, `no-throw-literal`, `semi` as `warn`); `.eslintrc.json` references both sub-projects' `tsconfig.json`. Lint scope is `client/src` and `server/src` only.
- Source files use **tabs** for indentation (test runner reads `AUTO_ACCEPT_REPLACE_TABS`). Do not convert to spaces.
- `server/src` files start with `/* eslint-disable eqeqeq */` in places that intentionally use loose equality — preserve those.
- MegaLinter (`.mega-linter.yml`) runs in CI but disables `TYPESCRIPT_ES` — `npm run lint` is the authoritative TS lint gate.

## When to contribute upstream

Linting-rule or CodeNarc behaviour issues belong in [`npm-groovy-lint`](https://github.com/nvuillam/npm-groovy-lint), not here. This repo only wraps it as a VS Code extension + LSP server.

## Debugging

`.vscode/launch.json` provides:
- `Launch Client` / `Attach to Server` (6009) — use the compound `Launch Client + Server` to debug both ends. Server attach requires the extension to start in debug mode.
- `Run Extension Tests` / `Run Extension Tests (Debug)` — equivalent to `npm test`, but in a debuggable VS Code host.