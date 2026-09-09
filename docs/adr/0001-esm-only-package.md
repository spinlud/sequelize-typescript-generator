# 0001. ESM-only package

- Status: Accepted
- Date: 2026-09-09

## Context

The package previously shipped CommonJS. Version 13 moves the toolchain to
TypeScript 6 with `module: nodenext` and raises the runtime floor to Node
`>=22.13.0`. That Node version supports `require()` of ESM modules that have no
top-level await, so CommonJS consumers can still load an ESM-only package. The
surrounding ecosystem is ESM-first: yargs and the ESLint 10 flat-config stack
are shipped primarily as ES modules.

## Decision

Ship the package as ESM only:

- `"type": "module"` in `package.json`.
- A single root `exports` entry plus `./package.json`; no other subpaths.
- A plain `tsc` build to `build/`, with no bundler and no dual CommonJS output.
- `.js` suffixes on relative imports, as `module: nodenext` requires.
- No top-level `await` in the shipped entry, so `require()` of the package from
  CommonJS keeps working. A test loads the root entry with `require()` from a
  CommonJS script to verify this.

## Consequences

- Consumers on Node `<22.13` are unsupported.
- No dual build to maintain.
- Deep imports into `build/` are not supported; the `exports` map exposes the
  root entry only.
- Generated model files are unchanged by this decision. Adding a `.js` suffix to
  relative imports in generated code, for strict Node ESM consumers, is a
  post-13 backlog item in the v13 upgrade plan
  (`docs/plans/v13-upgrade-plan.md`).
