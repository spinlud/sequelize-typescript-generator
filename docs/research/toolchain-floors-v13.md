# Runtime and toolchain floors for version 13

Research for [#64](https://github.com/spinlud/sequelize-typescript-generator/issues/64). Facts checked against primary sources on 2026-09-08; every claim links to the source that owns it. Repo baseline at time of writing: `typescript ^5.7.2`, `eslint ^8.57.0`, `@typescript-eslint/parser ^7.2.0`, `yargs ^17.7.2`, `change-case ^4.1.2`, plain `tsc` build (`target ES2019`, `module CommonJS`, `experimentalDecorators` + `emitDecoratorMetadata`), no `engines` field.

## 1. Node.js

Source: [nodejs/Release `schedule.json`](https://raw.githubusercontent.com/nodejs/Release/main/schedule.json) (phase definitions in the [README](https://github.com/nodejs/Release)).

| Line | Codename | Current | Active LTS | Maintenance | End of life |
|---|---|---|---|---|---|
| 20 | Iron | 2023-04-18 | 2023-10-24 | 2024-10-22 | **2026-04-30** (EOL) |
| 22 | Jod | 2024-04-24 | 2024-10-29 | 2025-10-21 | 2027-04-30 |
| 24 | Krypton | 2025-05-06 | 2025-10-28 | **2026-10-20** | 2028-04-30 |
| 26 | — | 2026-05-05 | 2026-10-28 | 2027-10-20 | 2029-04-30 |

Status on 2026-09-08:

- **Oldest (and only) Active LTS: Node 24.** It moves to Maintenance on **2026-10-20**, the week after Node 26 becomes Active LTS (2026-10-28).
- Node 22 is in Maintenance until 2027-04-30. Node 20 has been EOL since 2026-04-30. Odd lines (21, 23, 25) never get LTS.
- Every supported line (22.12+, 24, 26) has `require(esm)` enabled by default (see §4.1).

Floors imposed by the toolchain candidates below: ESLint 10 `^20.19.0 || ^22.13.0 || >=24`, yargs 18 `^20.19.0 || ^22.12.0 || >=23`, tshy 4 `20 || >=22`, tsdown `^22.18.0 || ^24.11.0 || >=26`, TypeScript 7 `>=16.20.0`.

**Suggested floor for v13: `"engines": { "node": ">=22.12.0" }`** (or `^22.12.0 || >=24`). Node 20 is already EOL, and 22.12 is the lowest line where `require(esm)` is on by default, which is what makes ESM-only dependencies (yargs 18, change-case 5) loadable from a CJS build.

## 2. TypeScript

### 2.1 Releases

Source: [npm registry `typescript`](https://registry.npmjs.org/typescript) (`dist-tags`, `time`) and the release blog.

| Version | Date | Notes |
|---|---|---|
| 5.7.3 | 2025-01-08 | last 5.7 |
| 5.8.2 / 5.8.3 | 2025-02-28 / 2025-04-05 | [notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html) |
| 5.9.2 / 5.9.3 | 2025-07-31 / 2025-09-30 | [notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-9.html) |
| 6.0.2 / 6.0.3 | 2026-03-23 / 2026-04-16 | last JS-based release; [notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html), [blog](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/) |
| **7.0.2** | 2026-07-08 | `dist-tags.latest`; native Go port; [blog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) |
| 7.1 | beta 2026-10-06, stable 2026-11-24 (planned) | [iteration plan](https://github.com/microsoft/TypeScript/issues/63703) |

`engines.node`: `>=14.17` for 5.x and 6.0.x, `>=16.20.0` for 7.0.2 ([registry](https://registry.npmjs.org/typescript/latest)).

### 2.2 Compiler API used by the model builder

The builder uses `ts.factory.*` (createIdentifier, createToken, createTypeReferenceNode, createClassDeclaration, createDecorator, createPropertyDeclaration, createImportDeclaration, createHeritageClause, ...), `ts.createPrinter`, `ts.createSourceFile`, `ts.ScriptTarget.Latest`, `ts.ScriptKind.TS`, `ts.EmitHint.Unspecified`, `ts.NewLineKind.LineFeed` and the `ts.SyntaxKind` token enums (`src/builders/utils.ts`, `src/builders/ModelBuilder.ts`).

- **No breaking changes from 5.7 through 6.0.3.** Neither the 5.8, 5.9 nor 6.0 release notes list Compiler API changes; the [API Breaking Changes wiki](https://github.com/microsoft/TypeScript/wiki/API-Breaking-Changes) has no entry after 5.3 (5.0 removed the pre-`ts.factory` top-level factory functions, which this code base does not use). `src/deprecatedCompat/deprecations.ts` registers zero deprecated overloads on `release-5.7`, `release-5.9` and [`release-6.0`](https://github.com/microsoft/TypeScript/blob/release-6.0/src/deprecatedCompat/deprecations.ts).
- Enum changes on [`release-6.0` `types.ts`](https://github.com/microsoft/TypeScript/blob/release-6.0/src/compiler/types.ts): `ScriptTarget.ES5` is `@deprecated` (ES3 already was); `ES2025` added and `LatestStandard = ES2025`; `ModuleKind.None/AMD/UMD/System` deprecated. `ScriptTarget.ES2019`, `ScriptTarget.Latest`, `ModuleKind.CommonJS`, `Node16/Node18/Node20/NodeNext` are unchanged.
- **TypeScript 7.0 has no programmatic API.** The 7.0.2 package has only `bin.tsc` and no `main`/`lib/typescript.js` ([registry](https://registry.npmjs.org/typescript/latest)). The announcement: "TypeScript 7.0 does not yet expose a stable programmatic API ... tools which embed TypeScript ... can only currently rely on TypeScript 6.0"; "We expect TypeScript 7.1 to ship with a new (and different) API" ([7.0 blog](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [Dec 2025 progress](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)). The 7.1 plan lists "Stabilize API" including an Emit API ([#63703](https://github.com/microsoft/TypeScript/issues/63703)).
- Side-by-side recipe from the 7.0 blog: `"typescript": "npm:@typescript/typescript6@^6.0.2"` (ships `tsc6` and the JS API; [registry](https://registry.npmjs.org/@typescript%2ftypescript6)) next to `"@typescript/native": "npm:typescript@^7.0.2"`.

**Implication for v13:** the runtime dependency and the peer range must stay on the JS compiler: `typescript` `>=5.x <6.1` (or `@typescript/typescript6`). A `^7` peer would break at import time. `@typescript-eslint/parser` has the same constraint (`>=4.8.4 <6.1.0`, §3.4). Revisit when 7.1 publishes its API (planned 2026-11-24).

### 2.3 tsconfig changes relevant to this repo

TypeScript 6.0 changes defaults and deprecates options; deprecations still work with `"ignoreDeprecations": "6.0"` and become hard errors in 7.0 ([6.0 notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html)):

- Defaults: `strict: true`, `module: esnext`, `target: es2025`, `types: []`, `rootDir: .`, `libReplacement: false`, `noUncheckedSideEffectImports: true`.
- Deprecated: `target: es5`, **`downlevelIteration`** (set in this repo's tsconfig; harmless to drop since `target` is ES2019), `moduleResolution node/node10/classic`, `module amd/umd/system/none`, `baseUrl`, `esModuleInterop: false`, `alwaysStrict: false`, `outFile`.
- 5.8 added `--module node18` and `--erasableSyntaxOnly`; 5.9 added `--module node20` (implies `target es2023`, supports `require(esm)`) and a new `tsc --init` template (`module nodenext`, `verbatimModuleSyntax`, `types: []`). 5.9 `lib.d.ts` makes `ArrayBuffer` no longer a supertype of typed arrays, which can surface `Buffer` assignability errors until `@types/node` is updated.

The generated models are unaffected: the printer emits syntax, not compiler options, and `experimentalDecorators` / `emitDecoratorMetadata` are not deprecated in 6.0 or 7.0 (sequelize-typescript still requires them, [README](https://github.com/sequelize/sequelize-typescript)).

## 3. ESLint

### 3.1 Version status

Source: [eslint.org/version-support](https://eslint.org/version-support/), [npm registry](https://registry.npmjs.org/eslint), [v10.0.0 release post](https://eslint.org/blog/2026/02/eslint-v10.0.0-released/).

| Line | Status | Last release | EOL | `engines.node` |
|---|---|---|---|---|
| 8.x (8.57.1) | EOL | 2024-09-16 | **2024-10-05** | `^12.22.0 \|\| ^14.17.0 \|\| >=16.0.0` |
| 9.x (9.39.5) | EOL | 2026-07-10 | **2026-08-06** | `^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0` |
| 10.x (10.10.0) | Current | 2026-09-04 | — | `^20.19.0 \|\| ^22.13.0 \|\| >=24` |

ESLint 9 is also EOL, so **the migration target is ESLint 10, not 9**. ESLint 10 removed eslintrc entirely: `ESLINT_USE_FLAT_CONFIG=false` no longer works and `LegacyESLint`/`FlatESLint` are gone ([migrate-to-10](https://eslint.org/docs/latest/use/migrate-to-10.0.0)). ESLint 9 still offered eslintrc via `LegacyESLint` from `eslint/use-at-your-own-risk` ([migrate-to-9](https://eslint.org/docs/latest/use/migrate-to-9.0.0)), which is why targeting 9 would only defer the same work by one major.

### 3.2 What the generator does today

- `src/lint/eslintDefaultConfig.ts` is an eslintrc object (`parser: '@typescript-eslint/parser'` string, `parserOptions`, `plugins: []`, `extends: []`) typed as `Linter.Config`.
- `src/lint/Linter.ts` does `new ESLint({ baseConfig, fix: true })` or `new ESLint(options)` with user-supplied `ESLint.Options`, then `lintFiles([outDir/*.ts])` + `ESLint.outputFixes`.
- `src/bin/utils.ts` turns `--lint-file` into `lintOptions: { configFile: <path>, fix: true }`. `configFile` is a CLIEngine-era option: ESLint 8.57's option validator rejects it ("Unknown options: configFile" / "'configFile' has been removed. Please use the 'overrideConfigFile' option instead.", `lib/eslint/eslint.js` `processOptions`). The error is not `MODULE_NOT_FOUND`, so `ModelBuilder` rethrows it; **the CLI `--lint-file` path is already broken on the current ESLint 8**.
- `IConfig.lintOptions` is `ESLint.Options` and is documented as a pass-through of ESLint options.

### 3.3 Migration requirements (ESLint 10 flat config)

Sources: [Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api), [configuration files](https://eslint.org/docs/latest/use/configure/configuration-files), [migration guide](https://eslint.org/docs/latest/use/configure/migration-guide), [`lib/types/index.d.ts`](https://raw.githubusercontent.com/eslint/eslint/main/lib/types/index.d.ts).

1. **Types.** `Linter.Config` is now the flat config type (`Linter.FlatConfig` is a deprecated alias, the eslintrc shape is `Linter.LegacyConfig`). The current default config object will not type-check.
2. **Default config becomes a flat config object** (or array):
   - `parser` must be an imported object: `languageOptions.parser = <import of '@typescript-eslint/parser'>`.
   - `parserOptions.ecmaVersion`/`sourceType` move to `languageOptions.ecmaVersion`/`languageOptions.sourceType` (defaults are already `"latest"` / `"module"`).
   - **`files: ['**/*.ts']` is required**: flat config only lints `**/*.js, **/*.cjs, **/*.mjs` by default, so without it `lintFiles(['out/*.ts'])` matches nothing.
   - `plugins` becomes an object map (`{ '@stylistic': stylistic }`), `extends` disappears (spread config arrays instead).
3. **Constructor options.** `new ESLint({ overrideConfigFile: true, baseConfig: [defaultConfig], fix: true })` for the default path; `overrideConfigFile: true` disables the lookup of an `eslint.config.*` in the user's cwd (today the eslintrc lookup silently merges any `.eslintrc` found there). `baseConfig`/`overrideConfig` accept a flat object or array.
4. **User config file.** `overrideConfigFile: '<path>'` loads a flat `eslint.config.js/.mjs/.cjs`. `.ts/.mts/.cts` config files are supported since 9.18.0 (2025-01-10) but need the optional `jiti >= 2.2.0` installed in the user's project ([9.18 post](https://eslint.org/blog/2025/01/eslint-v9.18.0-released/), [config files](https://eslint.org/docs/latest/use/configure/configuration-files#typescript-configuration-files)). Fix `src/bin/utils.ts` to emit `overrideConfigFile` instead of `configFile`. Users' existing `.eslintrc` lint files will no longer work and must be rewritten as flat config (a documented breaking change for v13).
5. **Pass-through options removed** in the flat `ESLint` class: `useEslintrc`, `extensions`, `resolvePluginsRelativeTo`, `rulePaths`, `ignorePath`, `reportUnusedDisableDirectives` (now `linterOptions.reportUnusedDisableDirectives` in config). Any of these in `IConfig.lintOptions` throws "Unknown options".
6. **Formatting rules.** `indent`, `padded-blocks`, `lines-between-class-members`, `object-curly-newline`, `object-property-newline` were all deprecated in 8.53.0 ([blog](https://eslint.org/blog/2023/10/deprecating-formatting-rules/)); each rule page now says "It will be removed in v11.0.0. Please use the corresponding rule in @stylistic/eslint-plugin" ([indent](https://eslint.org/docs/latest/rules/indent)). They still run in ESLint 10, so the migration can be done in two steps, but the durable fix is `@stylistic/eslint-plugin` (latest 5.10.0, 2026-03-06; peer `eslint ^9 || ^10`; ESM-only since v4; single package since v5) with rule names prefixed `@stylistic/` ([migration](https://eslint.style/guide/migration), [registry](https://registry.npmjs.org/@stylistic/eslint-plugin)). `@stylistic/indent` also understands TypeScript syntax, which the core `indent` rule never did ([rule](https://eslint.style/rules/indent)). Being ESM-only, it must be `import`ed (fine under `require(esm)` on Node >=22.12 or from an ESM build).

Target shape of the default config:

```ts
import tsParser from '@typescript-eslint/parser';
import stylistic from '@stylistic/eslint-plugin';

export const eslintDefaultConfig: Linter.Config = {
    files: ['**/*.ts'],
    languageOptions: { parser: tsParser, ecmaVersion: 2019, sourceType: 'module' },
    plugins: { '@stylistic': stylistic },
    rules: {
        '@stylistic/padded-blocks': ['error', { blocks: 'always', classes: 'always', switches: 'always' }],
        '@stylistic/lines-between-class-members': ['error', 'always'],
        '@stylistic/object-curly-newline': ['error', { /* unchanged options */ }],
        '@stylistic/object-property-newline': ['error'],
        '@stylistic/indent': ['error', 'tab'],
    },
};
```

### 3.4 `@typescript-eslint/parser` v8

Source: [npm registry](https://registry.npmjs.org/@typescript-eslint/parser), [dependency versions](https://typescript-eslint.io/users/dependency-versions), [v8 announcement](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8).

- Latest **8.70.0** (2026-09-07); there is no v9. Peers: `eslint ^8.57.0 || ^9.0.0 || ^10.0.0`, `typescript >=4.8.4 <6.1.0`; `engines.node ^18.18.0 || ^20.9.0 || >=21.1.0`.
- **Yes, v8 supports flat config** (and still eslintrc on ESLint 8/9). In flat config the parser is the imported module set on `languageOptions.parser`; parser options (`project`, `projectService`, `extraFileExtensions`, ...) go under `languageOptions.parserOptions` ([parser docs](https://typescript-eslint.io/packages/parser)). The `typescript-eslint` meta package re-exports it as `tseslint.parser`.
- The `<6.1.0` TypeScript ceiling reinforces §2.2: the lint feature cannot run on TypeScript 7 until typescript-eslint adopts the 7.1 API.

## 4. Dual CommonJS + ESM packaging

### 4.1 Node's current position: `require(esm)`

Source: [modules.html "Loading ECMAScript modules using require()"](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require).

- Unflagged in **20.19.0, 22.12.0, 23.0.0**; warning-free from 20.19.0 / 22.13.0 / 23.5.0; **no longer experimental as of 25.4.0**. Works only for synchronous ESM graphs (no top-level `await`, else `ERR_REQUIRE_ASYNC_MODULE`). `require()` returns the namespace object (default on `.default`, `__esModule: true` added); an ESM can `export { X as 'module.exports' }` to control the CJS shape.
- The old "Dual CommonJS/ES module packages" guidance was removed from `packages.html`; it now points to [nodejs/package-examples](https://github.com/nodejs/package-examples), whose dual-packages chapter is marked: "A lot of the information below has been outdated since Node.js started to support `require(esm)`. Do not follow the documentation below for new packages for the time being" ([source](https://raw.githubusercontent.com/nodejs/package-examples/main/guide/07-dual-packages/README.md)). The published chapter "Shipping ESM for CommonJS consumers" recommends **ESM-only with `"engines": { "node": "^20.19.0 || >=22.12.0" }`**, and the `module-sync` condition plus a CJS `default` only for packages that must support older Node ([source](https://raw.githubusercontent.com/nodejs/package-examples/main/guide/04-cjs-esm-interop/shipping-esm-for-cjs/README.md)).
- `exports` rules still apply for dual packages ([packages.html#conditional-exports](https://nodejs.org/api/packages.html#conditional-exports)): key order matters (most specific first), `types` first inside each condition, `import`/`require` mutually exclusive, `default` last. The dual package hazard (two module instances, broken `instanceof`) remains whenever both builds are loadable.
- The two dependencies that block a plain CJS build are already ESM-only: **yargs 18** (18.1.0, 2026-07-26; `exports` has no `require` condition; `engines ^20.19.0 || ^22.12.0 || >=23`, explicitly the `require(esm)` floor; yargs 17.7.3 remains dual, [registry](https://registry.npmjs.org/yargs/latest), [changelog](https://raw.githubusercontent.com/yargs/yargs/main/CHANGELOG.md)) and **change-case 5** (pure ESM, "cannot be `require`'d", [README](https://github.com/blakeembrey/change-case)). A CJS build can still `require()` them on Node >=22.12, but TypeScript only type-checks that under `module: nodenext` (not `node16/18/20`, [modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html)).

### 4.2 TypeScript constraints for dual emit

Source: [Modules reference](https://www.typescriptlang.org/docs/handbook/modules/reference.html), [choosing compiler options](https://www.typescriptlang.org/docs/handbook/modules/guides/choosing-compiler-options.html), [arethetypeswrong](https://github.com/arethetypeswrong/arethetypeswrong.github.io).

- `node16/node18/node20/nodenext` are "the only correct `module` options for all apps and libraries that are intended to run in Node.js"; the module format of each file is detected from its extension (`.mts/.cts`) or the nearest `package.json` `"type"`. Only `nodenext` (and `node20`) model `require(esm)`.
- `tsc` has **no built-in dual emit**; two configs mean two type checks. Relative imports need explicit `.js` extensions for the ESM output; `rewriteRelativeImportExtensions` (5.7) rewrites `.ts` to `.js` only and cannot produce `.mjs`/`.cjs` variants.
- Declarations must mirror the JS format one-to-one: a single `index.d.ts` served for both `import` and `require` produces attw's **"Masquerading as CJS"** (FalseCJS) or **"Masquerading as ESM"** (FalseESM) problems and lets TypeScript accept imports that crash at runtime. Fix: separate `.d.ts` per build (or `.d.mts`/`.d.cts`) with `types` inside each `import`/`require` condition.
- `__dirname`/`require` do not exist in ESM (`import.meta.dirname/filename` are stable since 22.16 / 24.0, [esm.html](https://nodejs.org/api/esm.html)); `import.meta` is a syntax error in CJS, so a shared source needs a per-dialect file or a bundler shim.
- `experimentalDecorators` + `emitDecoratorMetadata` emit identically in both formats with `tsc`, so decorators are only a problem for bundlers.

### 4.3 Options and trade-offs

| Option | How dual output is produced | Decorator metadata | `bin` | Maintenance / floors |
|---|---|---|---|---|
| **tsc, two tsconfigs** | `tsconfig.esm.json` -> `dist/esm` + `{"type":"module"}` stub; `tsconfig.cjs.json` -> `dist/commonjs` + `{"type":"commonjs"}` stub; hand-written `exports` with `types` per condition; two type checks; per-dialect `.cts`/`.mts` file for `__dirname`/`import.meta` | Native `tsc`, works | Shebang preserved; point `bin` at one build | No extra dependency; most manual (stubs, exports, attw check) |
| **tshy** 4.1.3 (2026-06-08) | Same recipe automated: runs `tsc` twice into `dist/esm` and `dist/commonjs`, writes the stubs and a correct `exports` (`types` under `import`/`require`) from `tshy.exports`; `<name>-cjs.cts` override files for polyfills; `dialects`, `esmDialects`/`commonjsDialects` ([README](https://github.com/isaacs/tshy)) | Native `tsc`, works | Not handled; set `bin` manually to `dist/esm/bin/cli.js` or the CJS one | Active; `engines 20 || >=22`; **depends on `typescript ^6.0.2`** ([registry](https://registry.npmjs.org/tshy/latest)) so it forces the TS 6 build toolchain; forces `module: NodeNext` |
| **tsup** 8.5.1 (2025-11-12) | esbuild bundle, `format: ['cjs','esm']`, `dts: true` emits `.d.ts` + `.d.mts`/`.d.cts`, `shims: true` for `__dirname`/`import.meta.url`, `cjsInterop` ([docs](https://raw.githubusercontent.com/egoist/tsup/main/docs/README.md)) | esbuild does not support `emitDecoratorMetadata` ([esbuild](https://esbuild.github.io/content-types/#typescript-caveats)); tsup falls back to SWC (optional `@swc/core` peer) with known source-map/debugger caveats | Auto `chmod +x` on shebang entries | **"This project is not actively maintained anymore. Please consider using tsdown instead"** ([README](https://github.com/egoist/tsup)); `engines >=18` |
| **tsdown** 0.23.0 (2026-09-03) | Rolldown bundle; ESM is the default, **CJS output is "maintenance-only"** ([output format](https://tsdown.dev/options/output-format)); `dts` via rolldown-plugin-dts; `exports: true` generates `package.json.exports`; `shims` | Oxc legacy decorators; Oxc's `emitDecoratorMetadata` "will fallback to `Object` type if it cannot calculate the type" ([oxc](https://oxc.rs/docs/guide/usage/transformer/typescript.html)), which would silently break sequelize-typescript's `design:type` inference; pass-through from tsconfig unverified | `@tsdown/exe` optional peer (docs unreachable) | Active but 0.x; `engines ^22.18.0 || ^24.11.0 || >=26` |
| **ESM-only** (Node's recommendation) | Single `tsc` build with `module: nodenext`, `"type": "module"`, `exports` with `types` + `default`; CJS consumers use `require(esm)`; `engines ^20.19.0 || >=22.12.0` | Native `tsc`, works | Trivial (`import.meta.dirname`) | Matches yargs 18 and change-case 5, which are already ESM-only; no dual package hazard; drops consumers on Node <20.19 |

Notes for this repo:

- The generator itself is mostly a CLI; the library entry (`ModelBuilder`, dialects, `IConfig`) is consumed programmatically by a minority of users. Both `tsc`-based options keep `emitDecoratorMetadata` correct, which the bundlers do not guarantee. That rules out tsup (unmaintained, SWC fallback) and makes tsdown risky for sequelize-typescript decorators.
- If dual output is kept, **tshy** is the lowest-effort correct implementation, at the cost of adopting TypeScript 6 for the build (the runtime `typescript` dependency used by the model builder can still be `^5.7 || ^6.0`). Plain two-config `tsc` is equivalent with more hand-written glue; validate either with `npx @arethetypeswrong/cli --pack`.
- **ESM-only** is the simplest and is what Node now recommends; the resulting floor (`>=20.19`, effectively `>=22.12` given Node 20 EOL) coincides with the floors already required by ESLint 10 and yargs 18. It is a breaking change for CJS consumers on older Node only.

## 5. Summary of floors for v13

| Concern | Floor / target | Driver |
|---|---|---|
| Node.js | `>=22.12.0` (Node 22 Maintenance until 2027-04-30; Node 24 Active LTS until 2026-10-20) | Node 20 EOL 2026-04-30; `require(esm)` unflagged; ESLint 10 needs `^20.19 \|\| ^22.13 \|\| >=24` |
| TypeScript (dependency + peer) | `>=5.7 <6.1` (JS compiler); do **not** allow 7.x | TS 7.0 has no programmatic API; 7.1 API planned 2026-11-24; typescript-eslint peer `<6.1.0` |
| TypeScript (build) | 6.0.x if using tshy; otherwise 5.9/6.0 | tshy 4 depends on `typescript ^6.0.2`; drop `downlevelIteration` before 7 |
| ESLint | **10.x** flat config | 8.x EOL 2024-10-05, 9.x EOL 2026-08-06; eslintrc removed in 10 |
| Formatting rules | `@stylistic/eslint-plugin` 5.x (`@stylistic/*` rule names) | Core rules deprecated since 8.53, removed in ESLint 11 |
| `@typescript-eslint/parser` | 8.x (8.70.0) | Supports ESLint 8.57/9/10 and flat config; no v9 exists |
| Packaging | ESM-only, or dual via tshy / two-config `tsc` | Bundlers cannot guarantee `emitDecoratorMetadata`; yargs 18 and change-case 5 are ESM-only |
| Known bug to fix regardless | `--lint-file` passes `configFile` | ESLint 8+ rejects it; must be `overrideConfigFile` |
