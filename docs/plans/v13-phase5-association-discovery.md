# Phase 5 (issue #79) implementation plan: automatic association discovery

Status: planned, not started
Implements: #79 (phase 5 of docs/plans/v13-upgrade-plan.md)
Depends on: phase 4 (#78, done on v13)
Open judgment call: with no `--case`, singular/plural aliases keep the database spelling and only composed aliases are camelCased.

Branch `v13`.

## Conventions

This plan follows the project conventions in the repository's CLAUDE.md files: no `any`, no type assertions (`as`, `as unknown as T`, non-null `!`), `satisfies` for checked literals, and `unknown` only at untyped boundaries then narrowed; library types first, derived second, custom last; comments in English describing the code as it is now (no history or "phase" markers); names like `calculateTotalRevenue`, booleans `is/has/should`, constants `UPPER_SNAKE_CASE`; the CONTEXT.md vocabulary (Association, Alias, Association discovery, Associations file, Junction table, Case); TDD at pure seams; the TypeScript compiler API for code emission; one commit per step with `v13 phase N: ...` subjects, with a separate agent creating the commits.

## 0. Facts that shape the design

- Pipeline today (`src/dialects/Dialect.ts` `buildTablesMetadata`): fetch → filter → per-table columns/indices/FKs → `applyForeignKeyConstraintsToColumns` → CSV block **overwrites** `tablesMetadata[t].associations = association.associations` (would wipe discovered associations) and rewrites `columns[c].foreignKey` → `caseTransformer`.
- `caseTransformer` mutates association objects in place (`src/dialects/utils.ts`) and `AssociationsParser.parse` returns one static cached object regardless of path. Together: a second `buildTablesMetadata` with a different case double-transforms `targetModel`. Must be fixed in this phase (copy-on-transform + per-path cache returning copies).
- `IAssociationMetadata` already has optional `alias`, `foreignKey`, `targetKey`, `onDelete`, `onUpdate`; nothing reads them yet.
- Emission (`ModelBuilder.buildAssociationPropertyDecl`): property name is `pluralize.plural/singular(targetModel)`; only decorator option emitted is `sourceKey`; imports of target models and the self-import guard exist; decorator names are imported from the `associations` list.
- `generateArrowDecorator` (`src/builders/utils.ts`) renders object props as literals in insertion order, so option key order is controlled by the props object.
- `pluralize` and `change-case` are already dependencies.
- sequelize-typescript sets `options.as = propertyName` when `as` is absent.
- yargs 17: `.option('associations', { boolean: true, default: true })` yields `associations: false` for `--no-associations`. Side finding: existing `--no-views`/`--no-strict` long forms are parsed as `views: false` so only `-V`/`-R` work today; pre-existing bug, out of scope, file a follow-up issue.
- A composite primary key containing the FK column sets `primaryKey: true` on that column, so the "FK column is the PK" 1:1 rule must require a single-column PK.
- Fixtures in all five dialects: `units.race_id → races` (CASCADE/RESTRICT; MSSQL NO ACTION for update), `employees.manager_id → employees` (SET NULL; MSSQL may differ, check mssql test metadata), `profiles.person_id UNIQUE → person` (CASCADE/CASCADE), `shipments(order_id,line_no) → order_lines` composite; `person`/`passport` have no DB FK (CSV puts FK on `passport.passport_id → person`). Golden is generated WITH the CSV.

## 1. Data model

Discovery **builds on** `applyForeignKeyConstraintsToColumns`; column-level `IColumnMetadata.foreignKey` stays as the `@ForeignKey`/`references` record. Extract the eligibility test into a shared classifier in `src/dialects/foreignKeys.ts`:

```ts
export const FOREIGN_KEY_SKIP_REASONS = ['composite', 'cross-schema', 'excluded-target'] as const;
export type ForeignKeySkipReason = typeof FOREIGN_KEY_SKIP_REASONS[number];
export type ForeignKeyClassification = { isEligible: true } | { isEligible: false; reason: ForeignKeySkipReason };
/** Single-column, generated target, same schema -> eligible; otherwise the first failing rule. */
export const classifyForeignKeyConstraint = (constraint: IForeignKeyConstraintMetadata, sourceSchema: string | undefined, generatedTables: ReadonlySet<string>): ForeignKeyClassification;
```
`applyForeignKeyConstraintsToColumns` uses the classifier with identical behaviour.

Discovered association for `units.race_id → races(race_id)` (pre-case, database names):

Source side (`units.associations`): `{ associationName: 'BelongsTo', targetModel: 'races', alias: 'race', foreignKey: 'race_id', targetKey: 'race_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }`
Target side (`races.associations`): `{ associationName: 'HasMany', targetModel: 'units', alias: 'units', foreignKey: 'race_id', sourceKey: 'race_id', onDelete: 'CASCADE', onUpdate: 'RESTRICT' }`

- `HasOne` on target when `constraint.isSourceColumnUnique` or (`column.primaryKey` and the source table has exactly one PK column); `HasMany` otherwise. `BelongsTo` always on source.
- `foreignKey` on both sides; `targetKey` (BelongsTo) / `sourceKey` (Has*) = referenced column.
- `onDelete`/`onUpdate` set only when normalized rule is not `'NO ACTION'`, on both sides.
- CSV-derived associations keep `alias` undefined → emission falls back to today's plural/singular rule (golden compat).
- `IForeignKey` in AssociationsParser gains `isJunctionForeignKey: boolean` (true for N:N rows).

## 2. Pure module `src/dialects/associationDiscovery.ts`

```ts
export interface IAssociationDiscoveryResult { tablesMetadata: ITablesMetadata; /* new objects */ warnings: string[]; /* one per skipped constraint */ }
export const discoverAssociations = (tablesMetadata: ITablesMetadata): IAssociationDiscoveryResult;
export const FOREIGN_KEY_COLUMN_SUFFIXES = ['_id', '_fk', 'Id', 'Fk'] as const;
/** 'race_id' -> 'race'; undefined when no suffix matches or remainder is empty. */
export const stripForeignKeyColumnSuffix = (columnName: string): string | undefined;
export interface IAliasPair { belongsToAlias: string; hasAlias: string; }
export const resolveAssociationAliases = (input: { sourceModel: string; targetModel: string; foreignKeyColumn: string; isAmbiguous: boolean; isOneToOne: boolean; }): IAliasPair;
export const formatForeignKeySkipWarning = (constraint: IForeignKeyConstraintMetadata, sourceSchema: string | undefined, reason: ForeignKeySkipReason): string;
export const isAssociationDiscoveryEnabled = (metadata: IConfigMetadata | undefined): boolean => metadata?.associations !== false;
```
No `console` inside. Input is post-filter, pre-case.

Algorithm, per table S in key order, per constraint in `foreignKeys` order:
1. classify; not eligible → push warning, continue.
2. `c = sourceColumns[0]`, `T = targetTable`, `k = targetColumns[0]`; find column by `originName === c` (skip silently if missing).
3. `isOneToOne = constraint.isSourceColumnUnique || (column.primaryKey && S has a single PK column)`.
4. `isAmbiguous = (#eligible constraints on S with targetTable === T) > 1 || S.originName === T`.
5. Aliases:
   - Unambiguous: `belongsToAlias = singular(T)`; `hasAlias = isOneToOne ? singular(S) : plural(S)`.
   - Ambiguous: `stripped = stripForeignKeyColumnSuffix(c)`. If defined: `belongsToAlias = stripped`, `hasAlias = camelCase(`${stripped} ${isOneToOne ? singular(S) : plural(S)}`)`. Else: `belongsToAlias = camelCase(`${singular(T)} ${c}`)`, `hasAlias = camelCase(`${c} ${plural|singular(S)}`)`.
   - Collision: each model keeps a Set of taken names seeded with its column field names and aliases already assigned. Candidates tried in order: primary, ambiguous form, fallback form, fallback + numeric suffix 2,3,... First free wins.
6. Push BelongsTo onto S and Has* onto T (self-reference: both onto S, BelongsTo first).

Examples (no --case): `units.race` / `races.units`; `profiles.person` / `person.profile` (HasOne); `employees.manager` / `employees.managerEmployees`; hypothetical `books(author_id, editor_id) → authors`: `books.author`, `books.editor`, `authors.authorBooks`, `authors.editorBooks`.

`--case` on aliases: applied by `caseTransformer` with `TransformTarget.COLUMN`. With no `--case`, singular/plural aliases keep database spelling (12.x compatible) and only composed aliases are camelCased. This is the open judgment call surfaced in the header.

`caseTransformer` (`src/dialects/utils.ts`): build new association objects (`map` with spread), transforming `targetModel`/`joinModel` (MODEL) and `sourceKey`/`alias`/`foreignKey`/`targetKey` (COLUMN); rebuild `columns[x].foreignKey` without mutating the input.

## 3. Associations file on top: `src/dialects/associationsFileMerge.ts` (pure)

```ts
export interface IAssociationsFileMergeResult { tablesMetadata: ITablesMetadata; warnings: string[]; }
export const applyAssociationsFile = (tablesMetadata: ITablesMetadata, parsed: IAssociationsParsed): IAssociationsFileMergeResult;
```
Replaces the inline CSV block in `Dialect.ts`; existing warning texts move into `warnings`.

Per parsed table S:
1. Table missing → warning, continue.
2. For each `foreignKeys` entry `{ name: c, targetModel: T, isJunctionForeignKey }`:
   - If not junction: remove the discovered BelongsTo on S with `foreignKey === c` and its paired Has* on the discovered targetModel whose `targetModel === S && foreignKey === c`. Keyed on (source table, FK column) only.
   - Junction row: remove nothing.
   - Column missing → warning; else `columns[c].foreignKey = { ...(discovered?.targetModel === T ? discovered : {}), name: c, targetModel: T }`.
3. **Append** `parsed[S].associations` to `tablesMetadata[S].associations` (instead of overwrite).
4. Alias collision after merge: if a CSV association's effective property name (plural/singular of targetModel) equals a discovered `alias` on the same model, drop the discovered association with warning `Association alias '<x>' on table '<S>' is used by both a discovered association and the associations file; the associations file entry is kept`.

Fixture consequences (golden with CSV): `units.ts`/`races.ts` unchanged (CSV replaces discovered pair); `person.ts` gains `HasOne profiles` alias `profile` + import; `profiles.ts` gains BelongsTo; `employees.ts` gains BelongsTo + HasMany.

`AssociationsParser`: replace static cache with `Map<string, IAssociationsParsed>` keyed by path, return structural copies; set `isJunctionForeignKey`.

## 4. `--no-associations`

- `IConfigMetadata.associations?: boolean; // Discover associations from foreign keys; undefined means enabled`.
- `src/bin/utils.ts`: `ASSOCIATIONS: 'associations'`; `buildConfig`: `...(argv[aliasesMap.ASSOCIATIONS] === false && { associations: false })`.
- `src/bin/cli.ts`: `.option(aliasesMap.ASSOCIATIONS, { boolean: true, default: true, describe: 'Discover one-to-one and one-to-many associations from foreign keys. Use --no-associations to disable.' })`, no short letter. Usage string gains `--no-associations`.
- With `associations: false`: skip `discoverAssociations` only; column `@ForeignKey` stays; associations file still works.

## 5. Emission in `src/builders/ModelBuilder.ts`

Exported pure helpers:
```ts
import type { BelongsToOptions, HasManyOptions, HasOneOptions } from 'sequelize';
export type AssociationDecoratorOptions = Partial<BelongsToOptions & HasManyOptions & HasOneOptions>;
/** Alias when discovered, otherwise plural/singular of the target model. */
export const resolveAssociationPropertyName = (association: IAssociationMetadata): string;
/** Options for @BelongsTo/@HasOne/@HasMany; undefined when empty. Key order: as, foreignKey, targetKey, sourceKey, onDelete, onUpdate. `as` is emitted only when alias is set (discovered associations). */
export const buildAssociationDecoratorProps = (association: IAssociationMetadata): AssociationDecoratorOptions | undefined;
```
Discovered associations emit `as: alias` (issue #79 says "with foreignKey and as"); CSV associations without alias emit no `as` (golden compat). `@ForeignKey(() => T)` on the column unchanged. Imports already handled (self-import guard exists).

Expected golden after change (generated with CSV): `units.ts`, `races.ts` unchanged. `profiles.ts` gains
```ts
	@BelongsTo(() => person, { as: "person", foreignKey: "person_id", targetKey: "person_id", onDelete: "CASCADE", onUpdate: "CASCADE" })
	person?: person;
```
`person.ts` gains `import { profiles }` and `@HasOne(() => profiles, { as: "profile", foreignKey: "person_id", sourceKey: "person_id", onDelete: "CASCADE", onUpdate: "CASCADE" }) profile?: profiles;`
`employees.ts` gains `@BelongsTo(() => employees, { as: "manager", foreignKey: "manager_id", targetKey: "employee_id", onDelete: "SET NULL" }) manager?: employees;` and `@HasMany(() => employees, { as: "managerEmployees", foreignKey: "manager_id", sourceKey: "employee_id", onDelete: "SET NULL" }) managerEmployees?: employees[];` (linter formatting applies).

## 6. Warnings (emitted once per constraint via `console.warn('[WARNING]', message)` in `buildTablesMetadata`)

- composite: `Foreign key constraint '<name>' on table '<table>' spans columns (<a>, <b>); Sequelize associations need a single column, so the columns are generated as plain attributes`
- cross-schema: `Foreign key constraint '<name>' on table '<schema>.<table>' references table '<targetSchema>.<target>' in another schema; the column is generated as a plain attribute`
- excluded target: `Foreign key constraint '<name>' on table '<table>' references table '<target>', which is not among the generated tables; the column is generated as a plain attribute`

`buildTablesMetadata` order after change: column FK copy inside the try; then (outside the fetch try) `if (isAssociationDiscoveryEnabled(config.metadata))` discover + warn; then `applyAssociationsFile` when `associationsFile` set (+ warn); then case transform.

## 7. Tests

Unit: `associationDiscovery.test.ts` (cardinality incl. composite PK → HasMany; on-rules only when not NO ACTION; alias rule cases; collisions; three skip warnings with exact wording; no mutation; deterministic order), `associationsFileMerge.test.ts`, `foreignKeys.test.ts` (classifier), `caseTransformer.test.ts` (alias/foreignKey/targetKey; no compounding on repeat), `associationsParser.test.ts` (isJunctionForeignKey; per-path cache; copies), `builders.test.ts` (resolveAssociationPropertyName, buildAssociationDecoratorProps key order, nodeToString snapshot), `cliConfig.test.ts` (associations false mapping; isAssociationDiscoveryEnabled).

Integration (`TestRunner.ts`, new `describe('Association discovery')` after `Foreign keys`, per dialect, both formats): build WITHOUT associationsFile (`indices: true`), assert via `Model.associations` (`associationType`, `foreignKey`, `as`): 1:N units/races (+ include counts); 1:1 profiles/person (HasOne; include yields object); composite skip (shipments/order_lines associations empty; `console.warn` spy captured the constraint name); self-reference alias (`manager`, `managerEmployees`; include 'manager' works with seeded rows); referential actions (`units.associations.race.options.onDelete === 'CASCADE'`; onUpdate asserted only when expectedForeignKeys says not NO ACTION). CSV override (existing Associations block, build with CSV): `Object.keys(units.associations)` equals `['race']`, `races` → `['units']`, `person` → `['passport','profile']`, `units.ts` text has no `onDelete`. `--no-associations` build: all `associations` empty; `units.ts` still has `@ForeignKey(() => races)`. `--case CAMEL` build: file text contains `managerEmployees?: employees[]` and `foreignKey: "managerId"`. Golden update and review.

## 8. README

Options block: `--associations ... [boolean] [default: true]` + usage line `--no-associations`. `## Associations` section rewrite: discovery default, cardinality rule, skipped FK kinds with warnings, N:N never inferred; "Alias rule" subsection; "Associations file precedence" paragraph; programmatic example shows `associations: false`. Check `src/tests/unit/readmeProgrammaticExample.test.ts` still passes.

## 9. Release `13.0.0-beta.2` on `next`

State: package.json version `12.0.1`; no publishConfig; `.github/workflows/ci.yml` publish job runs on `v*` tags, `--tag next` when tag contains `-`, needs `secrets.NPM_TOKEN`; `13.0.0-beta.1` was never published (#84 open, ready-for-human, token missing). Agent-doable: `npm version 13.0.0-beta.2 --no-git-tag-version`, commit. Human: add NPM_TOKEN, `git tag v13.0.0-beta.2 && git push origin v13 v13.0.0-beta.2`; or `npm publish --access public --tag next` manually.

## 10. Ordered steps

1. Classifier + discovery module (+ unit tests). Commit: `v13 phase 5: derive associations and aliases from foreign key constraints`.
2. Associations file merge + parser per-path cache/copies + caseTransformer copy-on-transform (+ unit tests). Commit: `v13 phase 5: apply the associations file on top of discovered associations`.
3. Emission helpers in ModelBuilder (+ unit tests; golden unchanged at this step). Commit: `v13 phase 5: emit as, foreignKey, keys and referential actions on association decorators`.
4. Config flag + CLI + pipeline wiring in Dialect.ts + golden update. Commit: `v13 phase 5: enable association discovery by default with --no-associations`.
5. Integration harness block; run all five dialects. Commit: `v13 phase 5: cover association discovery in the integration harness`.
6. README. Commit: `v13 phase 5: document association discovery and --no-associations`.
7. Version bump to 13.0.0-beta.2. Commit: `v13 phase 5: bump version to 13.0.0-beta.2`. Comment on #79/#84; follow-up issue for `--no-views`/`--no-strict` long forms.

## Risks
- Discovery on by default means every existing integration block emits associations; self-ref/1:1 emission bugs show up as compile failures everywhere.
- MSSQL reports `NO ACTION` for `ON UPDATE RESTRICT`; key onUpdate assertions off `expectedForeignKeys`.
- Composite-PK guard matters for junction tables with `PRIMARY KEY (a, b)`.
- Publishing depends on a human adding NPM_TOKEN.
