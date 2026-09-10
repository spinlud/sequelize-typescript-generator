# Version 13 upgrade plan

Ordered, hand-off plan for sequelize-typescript-generator 13.0.0. Decisions were made on the wayfinder map [Sequelize v6 native format and v13 upgrade plan](https://github.com/spinlud/sequelize-typescript-generator/issues/62); each phase links the decision tickets it implements. Progress is tracked in the GitHub milestone [13.0.0](https://github.com/spinlud/sequelize-typescript-generator/milestone/1), one issue per phase, chained by native issue dependencies.

## Destination

Sequelize v6 only. A new default **native** output format (plain Sequelize classes with `declare` fields and `Model.init`, plus a generated `initModels.ts` wiring file) and the existing **decorators** format behind `--format decorators` with a target-project dependency warning. Automatic association discovery from foreign keys. ESM-only package on Node `>=22.13.0`. A CI matrix over dialect and two database versions per engine.

## Standing decisions

| Topic | Decision | Ticket |
|---|---|---|
| Sequelize version | v6 only; v7 out of scope while alpha | map |
| Output formats | `--format native\|decorators`, native default, hence a new major | map, [#69](https://github.com/spinlud/sequelize-typescript-generator/issues/69) |
| Programmatic API | `IConfig.format`; single `ModelBuilder` entry; `createDialect`; explicit root re-export list; `build()` throws, never exits | [#82](https://github.com/spinlud/sequelize-typescript-generator/issues/82) |
| Migration guide | README checklist + `docs/migration/12-to-13.md`; Release notes are the changelog; `12.x` cut in phase 1 | [#83](https://github.com/spinlud/sequelize-typescript-generator/issues/83) |
| Emitter approach | TypeScript compiler API, structured like `ModelBuilder.ts`; no templates | [#68](https://github.com/spinlud/sequelize-typescript-generator/issues/68) |
| Module format | ESM-only (dual build revised away); ADR written in phase 2 | [#71](https://github.com/spinlud/sequelize-typescript-generator/issues/71) |
| Runtime floor | `engines.node >=22.13.0`; single Node version in CI | [#71](https://github.com/spinlud/sequelize-typescript-generator/issues/71), [#72](https://github.com/spinlud/sequelize-typescript-generator/issues/72) |
| TypeScript | build on 6.0.x; dependency and peer `>=5.7 <6.1` | [#71](https://github.com/spinlud/sequelize-typescript-generator/issues/71) |
| Lint | ESLint 10 flat config, `@stylistic` rules, legacy eslintrc fails fast, lint stack stays a hard dependency | [#71](https://github.com/spinlud/sequelize-typescript-generator/issues/71) |
| SQLite driver | `@vscode/sqlite3` via `dialectModule`; `sqlite3` no longer documented or tested | [#71](https://github.com/spinlud/sequelize-typescript-generator/issues/71) |
| `sequelize-typescript` | optional peer dependency; generator imports only `sequelize` at runtime | [#67](https://github.com/spinlud/sequelize-typescript-generator/issues/67) |
| Association discovery | on by default in both formats, `--no-associations` disables; 1:1 and 1:N only; associations file kept and applied on top | [#70](https://github.com/spinlud/sequelize-typescript-generator/issues/70) |
| New features | SQL Server `schema` and `hasTrigger` as unconditional fixes; `--paranoid` opt-in; no allowlist mechanism | [#73](https://github.com/spinlud/sequelize-typescript-generator/issues/73) |
| Test matrix | format is not a job axis; 8 server jobs + SQLite; PR subset runs latest DB per dialect; weekly and `v*` tags run the full matrix and gate a provenance publish | [#72](https://github.com/spinlud/sequelize-typescript-generator/issues/72) |
| Package name | kept | map |

## Phases

Phases run in order; each phase issue is blocked by the previous one. Effort is in dev-days, calibrated against the prototype's measured 11 to 15 dev-days for emitter plus discovery ([#68](https://github.com/spinlud/sequelize-typescript-generator/issues/68)). Total: **26 to 39 dev-days**.

| # | Phase | Issue | Dev-days | Publishes |
|---|---|---|---|---|
| 1 | Dependency shape | [#75](https://github.com/spinlud/sequelize-typescript-generator/issues/75) | 1 to 2 | |
| 2 | Toolchain | [#76](https://github.com/spinlud/sequelize-typescript-generator/issues/76) | 4 to 6 | |
| 3 | Test and CI matrix | [#77](https://github.com/spinlud/sequelize-typescript-generator/issues/77) | 4 to 6 | `13.0.0-beta.1` |
| 4 | Metadata layer | [#78](https://github.com/spinlud/sequelize-typescript-generator/issues/78) | 4 to 6 | |
| 5 | Association discovery | [#79](https://github.com/spinlud/sequelize-typescript-generator/issues/79) | 3 to 5 | `13.0.0-beta.2` |
| 6 | Native emitter | [#80](https://github.com/spinlud/sequelize-typescript-generator/issues/80) | 8 to 11 | `13.0.0-beta.3` |
| 7 | Release | [#81](https://github.com/spinlud/sequelize-typescript-generator/issues/81) | 2 to 3 | `13.0.0` |

### Phase 1: dependency shape

Implements [#67](https://github.com/spinlud/sequelize-typescript-generator/issues/67).

- Entry: none; unblocked at plan creation.
- Work: tag the 12.0.1 commit `v12.0.1` and cut branch `12.x` from it; replace the six value imports of `sequelize-typescript` (`createConnection.ts` and the five dialect files) with `Sequelize` and `DataTypes` from `sequelize`; move `sequelize-typescript` to an optional peer dependency, kept in `devDependencies`; keep `reflect-metadata` dev-only; add a guard that fails when shipped source value-imports `sequelize-typescript`.
- Exit: no `require("sequelize-typescript")` in `build/`; guard active; existing tests green; `v12.0.1` tag and `12.x` branch pushed.

### Phase 2: toolchain

Implements [#71](https://github.com/spinlud/sequelize-typescript-generator/issues/71), built on research [#64](https://github.com/spinlud/sequelize-typescript-generator/issues/64) and [#65](https://github.com/spinlud/sequelize-typescript-generator/issues/65).

- Entry: phase 1 closed.
- Work: ESM-only build with plain `tsc`, `module: nodenext`, `"type": "module"`, `exports` map with a single root entry plus `./package.json`; `.js` suffix on relative imports; `yargs(hideBin(process.argv))`; `engines.node >=22.13.0`; TypeScript 6.0.x build, peer range `>=5.7 <6.1`, drop `downlevelIteration`; Jest 30 with the ts-jest ESM preset and `jest.config.cjs`; `tsx` for dev scripts; ESLint 10 flat config with `@stylistic/eslint-plugin`, `@typescript-eslint/parser` 8.x; default lint path uses `overrideConfigFile: true` with `baseConfig`; `--lint-file` passes `overrideConfigFile`; legacy eslintrc files and objects fail fast with a pointer to the ESLint migration guide; SQLite dialect resolves `@vscode/sqlite3` from the user's project as `dialectModule`; ADR for ESM-only in `docs/adr/`; glossary term **Driver** in `CONTEXT.md`; programmatic API (#82): root barrel re-exports `Dialect`, `DialectName`, `createDialect`, the `IConfig*`/`Transform*` types and the metadata interfaces, `Builder`/`Linter`/utils stay private, `build()` throws instead of `process.exit`.
- Exit: builds and runs ESM-only on Node 22.13; suite green under Jest 30; both lint paths tested; legacy eslintrc rejected; ADR committed; root entry loads via `require()` from CommonJS (no top-level await).

### Phase 3: test and CI matrix

Implements [#72](https://github.com/spinlud/sequelize-typescript-generator/issues/72).

- Entry: phase 2 closed.
- Work: `checks` job then integration jobs; PR subset runs the latest version per dialect plus SQLite; weekly schedule and `v*` tags run the full 8-server matrix plus SQLite and gate a provenance `publish` job; GitHub `services:` containers with minor-pinned tags; dialect-neutral `wait-for-db` script; local `docker-compose.yml` with one profile per dialect and `npm run test:<dialect>`; delete the `docker-*.sh` scripts; `describe.each` over formats in `TestRunner.ts`; strict `tsc --noEmit` test over generated output; one SQLite golden fixture per format with `npm run test:golden:update`; lint `-L` success and fail-fast tests; gitignore generated output.
- Exit: PR subset and full matrix green; shell scripts removed; golden fixture and compile check running for the decorators format; `13.0.0-beta.1` published on the npm `next` tag.

### Phase 4: metadata layer

Implements the metadata part of [#70](https://github.com/spinlud/sequelize-typescript-generator/issues/70), [#73](https://github.com/spinlud/sequelize-typescript-generator/issues/73), and the gaps listed by [#68](https://github.com/spinlud/sequelize-typescript-generator/issues/68).

- Entry: phase 3 closed.
- Work: per-dialect foreign key fetch (constraint name, source and target columns, `ON DELETE`/`ON UPDATE`, single-column uniqueness of the source column) on all five dialects; extended `IColumnMetadata.foreignKey` and `IAssociationMetadata`; mapper from database types to `DataTypes.*`; `--paranoid` flag; SQL Server `schema` in table options and `hasTrigger` detection.
- Exit: foreign key fetch tested per dialect in the matrix; `--paranoid` and SQL Server fixes covered by integration tests; matrix green.

### Phase 5: association discovery

Implements [#70](https://github.com/spinlud/sequelize-typescript-generator/issues/70).

- Entry: phase 4 closed.
- Work: cardinality rule, hybrid alias rule with `--case`, warnings for composite, cross-schema and excluded-target foreign keys, associations file applied on top, `--no-associations`, `onDelete`/`onUpdate` when not `NO ACTION`; decorators emission through `@ForeignKey`, `@BelongsTo`, `@HasMany`/`@HasOne` with `foreignKey` and `as`.
- Exit: discovery tests per dialect; decorators golden fixture updated; `13.0.0-beta.2` published on `next`.

### Phase 6: native emitter

Implements [#69](https://github.com/spinlud/sequelize-typescript-generator/issues/69), [#68](https://github.com/spinlud/sequelize-typescript-generator/issues/68), [#63](https://github.com/spinlud/sequelize-typescript-generator/issues/63), and the native parts of [#70](https://github.com/spinlud/sequelize-typescript-generator/issues/70) and [#73](https://github.com/spinlud/sequelize-typescript-generator/issues/73).

- Entry: phase 5 closed **and** [Specify the programmatic API shape for the native format](https://github.com/spinlud/sequelize-typescript-generator/issues/82) closed.
- Work: `--format native|decorators` with native default; compiler API renderer sharing `ModelBuilder.ts` helpers; one file per model, `initModels.ts`, `index.ts`; flag behaviours per the native specification; decorators dependency warning via `require.resolve` from the output directory, never failing; programmatic API (#82): `IConfig.format` top level defaulting to `native`, `ModelBuilder` dispatches on format internally, `initModel` returns the class, `initModels` contract native-only.
- Exit: both formats run in every matrix job; native output passes strict `tsc --noEmit` and runtime assertions on all dialects; native golden fixture committed; README documents `--format`; `13.0.0-beta.3` published on `next`.

### Phase 7: release

Implements the release strategy from [#74](https://github.com/spinlud/sequelize-typescript-generator/issues/74).

- Entry: phase 6 closed **and** [Decide the 12.x to 13.x migration guide contents](https://github.com/spinlud/sequelize-typescript-generator/issues/83) closed.
- Work: README section "Migrating from 12.x" plus `docs/migration/12-to-13.md` per [#83](https://github.com/spinlud/sequelize-typescript-generator/issues/83); GitHub Release notes on the fixed template as breaking-change notice and changelog (no `CHANGELOG.md`, no `npm deprecate`); tag `v13.0.0` so the full matrix publishes with provenance.
- Exit: `13.0.0` on npm `latest`; GitHub Release published; README section and guide merged.

## Release strategy

- Pre-releases `13.0.0-beta.1`, `.2`, `.3` on the npm `next` tag after phases 3, 5 and 6. Each exposes one breaking area in turn: ESM-only packaging, discovery on by default, native output as default.
- Breaking-change notice: GitHub Release notes on a fixed template (summary, breaking changes copied from the README checklist, guide link, install command, auto-generated commits), used for the betas too. No `CHANGELOG.md`, no `npm deprecate` on 12.x.
- `12.x` branch cut from the retro-tagged `v12.0.1` commit at the start of phase 1; security fixes only until 2027-03-31, stated in the migration guide. No final 12.x pointer patch.

## Breaking changes in 13.0.0

- Default output format is native; decorators output requires `--format decorators`.
- ESM-only package; CommonJS consumers load it through `require(esm)` and need TypeScript `module: node20` or `nodenext`.
- Node `>=22.13.0`.
- `--lint-file` accepts flat config files only; legacy `.eslintrc*` fails fast.
- SQLite uses `@vscode/sqlite3`; `sqlite3` is no longer supported.
- Associations are discovered from foreign keys by default; `--no-associations` restores the previous behaviour.
- Deep imports under `build/` are closed by the `exports` map.

## Decisions still open before implementation reaches them

None. Both gates are resolved; see Standing decisions.

## Post-13 backlog

Ruled out of version 13 but worth keeping in view:

- Optional alias column in the associations file.
- Optional flag adding the `.js` suffix to relative imports in generated files for strict Node ESM consumers.
- Column-level `unique: true` without duplicating the `--indices` constraint on `sequelize.sync()`.
- Opt-in `validate.len` (decorators: `@Length`) from declared string column length.
- Junction table heuristic to discover many-to-many associations.
- Moving the lint stack to optional peer dependencies.
- Sequelize v7 support, as a fresh effort if a v7 beta ships.
- `ModelBuilder.build()` returning the list of written file paths.

## Phase plans

Detailed, step-by-step implementation plans for the phases that have one:

- Phase 5, association discovery (#79): [`docs/plans/v13-phase5-association-discovery.md`](v13-phase5-association-discovery.md).
- Phase 6, native emitter (#80): [`docs/plans/v13-phase6-native-emitter.md`](v13-phase6-native-emitter.md).
