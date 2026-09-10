# Phase 6 (issue #80) implementation plan: native output format emitter

Status: planned, not started
Implements: #80 (phase 6 of docs/plans/v13-upgrade-plan.md)
Depends on: phase 4 (#78, done on v13)
Depends on: phase 5 (#79)

Branch `v13`.

## Conventions

This plan follows the project conventions in the repository's CLAUDE.md files: no `any`, no type assertions (`as`, `as unknown as T`, non-null `!`), `satisfies` for checked literals, and `unknown` only at untyped boundaries then narrowed with a guard; library types first (sequelize's `ModelAttributeColumnOptions`, `InitOptions`, `BelongsToOptions`, ...), derived second, custom last; comments in English describing the code as it is now (no history or "phase" markers); names like `calculateTotalRevenue`, booleans `is/has/should`, constants `UPPER_SNAKE_CASE`; the CONTEXT.md vocabulary (Format, Native format, Decorators format, Wiring file, Strict mode); TDD at pure seams; the TypeScript compiler API (`ts.factory`) only, never string templates, for code emission; one commit per step with `v13 phase N: ...` subjects, with a separate agent creating the commits.

## 0. Facts that shape the design

This plan was written against the phase 4 state of `v13`.

- `ModelBuilder.build()` already returns after `console.warn("Couldn't find any table ...")` before mkdir/clean/write, so the zero-tables rule (nothing emitted, one warning) already holds. It writes one file per table plus `index.ts`, lints `outDir/*.ts`; rendering is `private static buildTableClassDeclaration(tableMetadata, dialect, strict)` plus `buildIndexExports`.
- `src/builders/utils.ts` `generateObjectLiteralDecorator` decides identifier-vs-string by sniffing `propValue.startsWith('DataType.') || propValue.startsWith('Sequelize.')` and prints single-line object literals (trailing-space artifacts in the decorators golden come from the ESLint fixer breaking those). `generateNamedImports` uses the deprecated boolean `createImportClause` overload; TypeScript 6 non-deprecated signature is `createImportClause(phaseModifier: SyntaxKind.TypeKeyword | SyntaxKind.DeferKeyword | undefined, name, namedBindings)`.
- `src/dialects/dataTypes.ts` has `DATA_TYPE_NAMESPACES.native = 'DataTypes'` and `renderDataTypeExpression` returns a string. `IColumnMetadata.sequelizeType` carries key + args, so the native renderer builds a real `ts.Expression`.
- Default values are decorators-spelled strings: MySQL/MariaDB `defaultValuesMap` yields `'DataType.NOW'`/`'DataType.UUIDV4'`; Postgres wraps every default as `Sequelize.literal("...")`; MySQL binary defaults come back as numbers. Native renderer normalises these.
- `dialect.mapDbTypeToJs` already returns `string` for Postgres `int8`/`numeric`/`money`, `object` for JSON/geometry, `string` for MySQL enum (#63 satisfied).
- **Pre-existing bug blocking native runtime tests:** `DialectSQLite.ts` `fetchColumnsMetadata` sets `allowNull: !!column.notnull` (inverted). Decorators output never emits `allowNull: false`, so nobody noticed. Native emits `allowNull: false`, so creates would fail on SQLite. Fix: `allowNull: !column.notnull`; changes decorators golden.
- `IConfig` has `strict?: boolean`, no `format`. `Format` lives only in `src/tests/integration/formats.ts`. CLI `-R/--no-strict` sets `strict: !(!!argv['no-strict'])`; yargs parses `--no-strict` as `strict: false` so only `-R` works (known follow-up).
- `src/lint/eslintDefaultConfig.ts` is stylistic only, format-neutral. But `@stylistic/padded-blocks: { blocks: 'always' }` pads every block statement including function bodies; native has `initModel`/`initModels` bodies. Recommendation: `{ blocks: 'never', classes: 'always', switches: 'always' }` (decorators output has no block statements so its golden is unaffected; README config block must be updated).
- `compileGeneratedModels.ts` hardcodes `experimentalDecorators`, `emitDecoratorMetadata`, `useDefineForClassFields: false`. `jest.config.cjs` also sets `useDefineForClassFields: false`; `declare` fields are unaffected by either.
- `TestRunner.ts` is decorators-bound at: `import { Sequelize } from 'sequelize-typescript'` and every `new Sequelize(...)`; `await import(indexDir)` + `connection!.addModels([...Object.values(models)])` under `// @ts-ignore` (Build, Data Types, Associations blocks); `connection!.addModels([ outDir ])` after `fs.unlink(indexDir)` (Tables/Skip tables/Skip views blocks); `compileGeneratedModels(outDir)`; `ITestMetadata.ts` types connections with sequelize-typescript's `Sequelize`. Golden dir is already `golden/${format}`. Phase 5 adds text assertions (`units.ts` has no `onDelete`, `@ForeignKey(() => races)`) that must become format-conditional.
- Prototype `origin/prototype/native-format:src/prototype-native/emitterFactory.ts` + `shared.ts` give reusable structure (descriptor layer + factory renderer). Do not carry over its `!` assertions or `references` emission (#69 emits no `references`).
- Spec conflict: #69 lists column `unique`; #73 rules it out (`--indices` carries it). Follow #73: no `unique` on columns.
- Sequelize facts: `Model.init` requires every non-`ForeignKey`-branded key of `InferAttributes<M>` in the attributes object (so `createdAt`/`updatedAt` must appear in `init` when `--timestamps`); `include: [Model]` works when exactly one association targets that model; `belongsToMany` deletes the auto `id` on a PK-less through model. Mixin accessor names come from `as`: to-one uses `upperFirst(as)`, to-many uses `upperFirst(as)` for plural forms and `upperFirst(singular(as))` for singular forms (Sequelize uses `inflection`; we use `pluralize`; runtime assertion covers divergence).

## 1. Expected native output (SQLite golden config: `indices: true`, associations CSV, no case, no timestamps, after the allowNull fix, discovery on)

Formatting: printer output is single-line imports and multi-line object literals (native passes `multiLine = true`), then default ESLint re-indents with tabs, breaks imports with >= 3 specifiers as `import {\n\t...  \n}` (trailing space after last specifier, like decorators golden), blank line between class members, padded class bodies, function bodies NOT padded. Indexed access types print with double quotes (`races["race_id"]`).

Member order per class: column attributes (metadata order), timestamp attributes, then per association its mixins, then one `NonAttribute` field per association, `declare static associations`, `static initModel`. Column option key order: `type, primaryKey, autoIncrement, allowNull, defaultValue, comment, field`. `allowNull` omitted on primary keys, explicit (`true`/`false`) on every other column. Init option key order: `sequelize, tableName, freezeTableName, schema, timestamps, paranoid, deletedAt, hasTrigger, comment, indexes`. Indexes whose field set equals the PK column set are skipped (MySQL `PRIMARY`, Postgres `*_pkey`, MSSQL `PK__*`, SQLite `sqlite_autoindex_*_1`).

### `units.ts`

```ts
import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { races } from "./races";

export class units extends Model<InferAttributes<units>, InferCreationAttributes<units>> {

	declare unit_id: CreationOptional<number>;

	declare unit_name: string;

	declare race_id: ForeignKey<races["race_id"]>;

	declare getRace: BelongsToGetAssociationMixin<races>;

	declare setRace: BelongsToSetAssociationMixin<races, races["race_id"]>;

	declare createRace: BelongsToCreateAssociationMixin<races>;

	declare race?: NonAttribute<races>;

	declare static associations: {
		race: Association<units, races>;
	};

	static initModel(sequelize: Sequelize): typeof units {
		units.init({
			unit_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			unit_name: {
				type: DataTypes.STRING,
				allowNull: false
			},
			race_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "units",
			freezeTableName: true,
			timestamps: false
		});
		return units;
	}

}
```

`indices.ts` init options example (exercises `--indices`):
```ts
		}, {
			sequelize,
			tableName: "indices",
			freezeTableName: true,
			timestamps: false,
			indexes: [
				{
					name: "indices_f_unique_uindex",
					unique: true,
					fields: ["f_unique"]
				},
				{
					name: "indices_f_multi_1_f_multi_2_uindex",
					unique: true,
					fields: ["f_multi_1", "f_multi_2"]
				},
				{
					name: "indices_f_not_unique_index",
					unique: false,
					fields: ["f_not_unique"]
				}
			]
		});
```
(`using` added when `IIndexMetadata.using` set; fields are database column names in `seq` order; index order is first-seen while scanning columns.)

### `races.ts` (HasMany from CSV, alias = plural of target)

```ts
import {
	Association, CreationOptional, DataTypes, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { units } from "./units";

export class races extends Model<InferAttributes<races>, InferCreationAttributes<races>> {

	declare race_id: CreationOptional<number>;

	declare race_name: string;

	declare getUnits: HasManyGetAssociationsMixin<units>;

	declare setUnits: HasManySetAssociationsMixin<units, units["unit_id"]>;

	declare addUnit: HasManyAddAssociationMixin<units, units["unit_id"]>;

	declare addUnits: HasManyAddAssociationsMixin<units, units["unit_id"]>;

	declare removeUnit: HasManyRemoveAssociationMixin<units, units["unit_id"]>;

	declare removeUnits: HasManyRemoveAssociationsMixin<units, units["unit_id"]>;

	declare hasUnit: HasManyHasAssociationMixin<units, units["unit_id"]>;

	declare hasUnits: HasManyHasAssociationsMixin<units, units["unit_id"]>;

	declare countUnits: HasManyCountAssociationsMixin;

	declare createUnit: HasManyCreateAssociationMixin<units, "race_id">;

	declare units?: NonAttribute<units[]>;

	declare static associations: {
		units: Association<races, units>;
	};

	static initModel(sequelize: Sequelize): typeof races {
		races.init({
			race_id: {
				type: DataTypes.INTEGER,
				primaryKey: true,
				autoIncrement: true
			},
			race_name: {
				type: DataTypes.STRING,
				allowNull: false
			}
		}, {
			sequelize,
			tableName: "races",
			freezeTableName: true,
			timestamps: false
		});
		return races;
	}

}
```

### `employees.ts` (self-ref BelongsTo `manager` + HasMany `managerEmployees`; no model import)

```ts
import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, HasManyAddAssociationMixin, HasManyAddAssociationsMixin, HasManyCountAssociationsMixin, HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin, HasManyHasAssociationsMixin, HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, HasManySetAssociationsMixin, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";

export class employees extends Model<InferAttributes<employees>, InferCreationAttributes<employees>> {

	declare employee_id: CreationOptional<number>;

	declare name: string;

	declare manager_id: ForeignKey<employees["employee_id"] | null>;

	declare getManager: BelongsToGetAssociationMixin<employees>;

	declare setManager: BelongsToSetAssociationMixin<employees, employees["employee_id"]>;

	declare createManager: BelongsToCreateAssociationMixin<employees>;

	declare getManagerEmployees: HasManyGetAssociationsMixin<employees>;

	declare setManagerEmployees: HasManySetAssociationsMixin<employees, employees["employee_id"]>;

	declare addManagerEmployee: HasManyAddAssociationMixin<employees, employees["employee_id"]>;

	declare addManagerEmployees: HasManyAddAssociationsMixin<employees, employees["employee_id"]>;

	declare removeManagerEmployee: HasManyRemoveAssociationMixin<employees, employees["employee_id"]>;

	declare removeManagerEmployees: HasManyRemoveAssociationsMixin<employees, employees["employee_id"]>;

	declare hasManagerEmployee: HasManyHasAssociationMixin<employees, employees["employee_id"]>;

	declare hasManagerEmployees: HasManyHasAssociationsMixin<employees, employees["employee_id"]>;

	declare countManagerEmployees: HasManyCountAssociationsMixin;

	declare createManagerEmployee: HasManyCreateAssociationMixin<employees, "manager_id">;

	declare manager?: NonAttribute<employees>;

	declare managerEmployees?: NonAttribute<employees[]>;

	declare static associations: {
		manager: Association<employees, employees>;
		managerEmployees: Association<employees, employees>;
	};

	static initModel(sequelize: Sequelize): typeof employees {
		employees.init({
			employee_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			name: { type: DataTypes.STRING, allowNull: false },
			manager_id: { type: DataTypes.INTEGER, allowNull: true }
		}, {
			sequelize,
			tableName: "employees",
			freezeTableName: true,
			timestamps: false
		});
		return employees;
	}

}
```
(object literals shown compact here; actual output is multi-line as in units.ts)

### `profiles.ts` (unique FK -> person; unique autoindex kept under `--indices`, PK autoindex skipped)

Imports Association, BelongsTo* mixins, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize; `import type { person } from "./person";`. Members: `declare profile_id: CreationOptional<number>; declare person_id: ForeignKey<person["person_id"]>; getPerson/setPerson/createPerson mixins; declare person?: NonAttribute<person>; declare static associations: { person: Association<profiles, person>; }`. Init options include `indexes: [{ name: "sqlite_autoindex_profiles_2", unique: true, fields: ["person_id"] }]`.

`person.ts` gains `declare profile?: NonAttribute<profiles>` plus HasOne mixins (`getProfile`, `setProfile`, `createProfile`) alongside the CSV `passport` HasOne, and `import type` for both.

### `authors_books.ts` (junction; both columns branded, no associations on the junction itself)

```ts
import {
	DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, Sequelize 
} from "sequelize";
import type { authors } from "./authors";
import type { books } from "./books";

export class authors_books extends Model<InferAttributes<authors_books>, InferCreationAttributes<authors_books>> {

	declare author_id: ForeignKey<authors["author_id"]>;

	declare book_id: ForeignKey<books["book_id"]>;

	static initModel(sequelize: Sequelize): typeof authors_books {
		authors_books.init({
			author_id: { type: DataTypes.INTEGER, allowNull: false },
			book_id: { type: DataTypes.INTEGER, allowNull: false }
		}, {
			sequelize,
			tableName: "authors_books",
			freezeTableName: true,
			timestamps: false
		});
		return authors_books;
	}

}
```
`authors.ts` carries the ten `BelongsToMany*` mixins for alias `books` (`getBooks`, `setBooks`, `addBook`, `addBooks`, `removeBook`, `removeBooks`, `hasBook`, `hasBooks`, `countBooks`, `createBook: BelongsToManyCreateAssociationMixin<books>`), `declare books?: NonAttribute<books[]>`, `books: Association<authors, books>`, and `import type` of `books` only (junction referenced only in the wiring file).

### `data_types.ts` (every non-PK column nullable -> `T | null`; autoincrement PK -> `CreationOptional`)

`declare id: CreationOptional<number>; declare f_int: number | null; ... declare f_varchar: string | null; ... declare f_blob: Uint8Array | null;` and init entries `f_int: { type: DataTypes.INTEGER, allowNull: true }` etc. with the same `DataTypes.X` as the decorators golden.

Typing rules: base type from `dialect.mapDbTypeToJs(col.type)` mapped to a type node (`number`, `string`, `boolean`, `Date`, `Uint8Array`, `object`); unknown mapping -> `unknown` plus existing `warnUnknownMappingForDataType`. ENUM: when `sequelizeType.key === 'ENUM'` with args, attribute type is the string-literal union `"AA" | "BB"` paired with `DataTypes.ENUM("AA", "BB")`; otherwise `string`. JSON/JSONB, GEOMETRY/GEOGRAPHY: `object`. Nullable + default -> `CreationOptional<T | null>`. Defaults: MySQL `CURRENT_TIMESTAMP` -> `defaultValue: DataTypes.NOW`, `uuid()` -> `DataTypes.UUIDV4`, Postgres default -> `Sequelize.literal("...")`, numbers bare, other strings quoted.

### `soft_deletes.ts` with `--paranoid --timestamps` (unit test + paranoid integration block; not in golden)

```ts
export class soft_deletes extends Model<InferAttributes<soft_deletes>, InferCreationAttributes<soft_deletes>> {

	declare id: CreationOptional<number>;

	declare name: string;

	declare deleted_at: CreationOptional<Date | null>;

	declare createdAt: CreationOptional<Date>;

	declare updatedAt: CreationOptional<Date>;

	static initModel(sequelize: Sequelize): typeof soft_deletes {
		soft_deletes.init({
			id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
			name: { type: DataTypes.STRING, allowNull: false },
			deleted_at: { type: DataTypes.DECIMAL, allowNull: true },
			createdAt: DataTypes.DATE,
			updatedAt: DataTypes.DATE
		}, {
			sequelize,
			tableName: "soft_deletes",
			freezeTableName: true,
			timestamps: true,
			paranoid: true,
			deletedAt: "deleted_at"
		});
		return soft_deletes;
	}

}
```
Decisions: paranoid column typed `CreationOptional<Date | null>` regardless of dialect JS mapping; its `type` stays the dialect mapping. `createdAt`/`updatedAt` declared `CreationOptional<Date>` and listed in `init` with `DataTypes.DATE` shorthand (Model.init requires every non-FK attribute key); no `field`. Without `--timestamps`: `timestamps: false`. Under `--case CAMEL`: `declare deletedAt` with `field: "deleted_at"` and option `deletedAt: "deletedAt"`. Note: if the phase 4 paranoid step added created_at/updated_at columns to the soft_deletes fixture, check how the timestamps test maps them and adapt (physical created_at columns stay plain attributes per #69; Sequelize's own createdAt/updatedAt attributes are separate unless `--case` maps them — verify against the existing timestamps integration test).

### `initModels.ts` (tables in `tablesMetadata` key order; wiring in table order then association order)

```ts
import { Sequelize } from "sequelize";
import { data_types } from "./data_types";
// ... one value import per model ...

export function initModels(sequelize: Sequelize) {
	data_types.initModel(sequelize);
	// ... every model ...
	authors.belongsToMany(books, {
		as: "books",
		through: authors_books,
		foreignKey: "author_id",
		otherKey: "book_id"
	});
	books.belongsToMany(authors, { as: "authors", through: authors_books, foreignKey: "book_id", otherKey: "author_id" });
	races.hasMany(units, { as: "units", foreignKey: "race_id", sourceKey: "race_id" });
	units.belongsTo(races, { as: "race", foreignKey: "race_id", targetKey: "race_id" });
	person.hasOne(passport, { as: "passport", foreignKey: "passport_id", sourceKey: "passport_id" });
	person.hasOne(profiles, { as: "profile", foreignKey: "person_id", sourceKey: "person_id", onDelete: "CASCADE", onUpdate: "CASCADE" });
	passport.belongsTo(person, { as: "person", foreignKey: "passport_id" });
	employees.belongsTo(employees, { as: "manager", foreignKey: "manager_id", targetKey: "employee_id", onDelete: "SET NULL" });
	employees.hasMany(employees, { as: "managerEmployees", foreignKey: "manager_id", sourceKey: "employee_id", onDelete: "SET NULL" });
	profiles.belongsTo(person, { as: "person", foreignKey: "person_id", targetKey: "person_id", onDelete: "CASCADE", onUpdate: "CASCADE" });
	return {
		data_types,
		// ... every model ...
	};
}

export type Models = ReturnType<typeof initModels>;
```
(object literals multi-line in real output)

Wiring decisions:
- Associations wired in `initModels`, never in `initModel` (#69: wiring file holds behaviour; model files stay free of value imports of other models).
- `as` always emitted; alias = `resolveAssociationPropertyName(association)` from phase 5 (discovered alias, else plural/singular of target). It keys `associations`, the `NonAttribute` property and mixin names.
- `foreignKey` always emitted. Discovered: `association.foreignKey`. CSV (no `foreignKey` on record): BelongsTo -> source table column whose `foreignKey.targetModel` equals the target; HasOne/HasMany -> target table column whose `foreignKey.targetModel` equals the source.
- `targetKey`/`sourceKey` when known (`association.targetKey`, else `column.foreignKey.targetKey`; `association.sourceKey`). `passport.belongsTo(person)` has neither, so omitted.
- `onDelete`/`onUpdate` only when present on the association.
- `belongsToMany`: `through` is the junction class identifier (value import in wiring file only); `foreignKey`/`otherKey` resolved from the junction's column `foreignKey.targetModel` records; omitted when unresolvable.
- Option key order: `as, through, foreignKey, otherKey, targetKey, sourceKey, onDelete, onUpdate`.
- `initModels` has no explicit return type: `Models = ReturnType<typeof initModels>`.
- `declare static associations: { race: Association<units, races> }` uses base `Association<S, T>`.
- Mixin `TModelPrimaryKey` arg is `Target["<pk attribute>"]` when target has exactly one PK column, else `number`; `HasManyCreateAssociationMixin<Target, "<fk attribute>">`, `HasOneCreateAssociationMixin<Target>`, `BelongsToCreateAssociationMixin<Target>`.
- Cross-model references in model files are `import type`; self-references import nothing. Extensionless specifiers.
- Excluded FK targets: column typed plain, no brand/association/import. Lookup by model **name** (post-case): build `Map<modelName, ITableMetadata>` once.

### `index.ts`
`export * from "./<model>";` per model, then `export * from "./initModels";` (reuse `generateIndexExport`).

## 2. Module layout and pure functions

### `src/config/IConfig.ts`
```ts
export const FORMATS = ['native', 'decorators'] as const;
export type Format = typeof FORMATS[number];
export const DEFAULT_FORMAT: Format = 'native';
export const isFormat = (value: unknown): value is Format => typeof value === 'string' && FORMATS.some(format => format === value);
export interface IConfig { connection; metadata?; output; lintOptions?; format?: Format; /* undefined means native */ strict?: boolean; /* decorators only; ignored with a notice in native */ }
```
### `src/config/format.ts`
```ts
export const resolveFormat = (config: IConfig): Format => config.format ?? DEFAULT_FORMAT;
export const shouldNoticeIgnoredStrict = (config: IConfig): boolean => resolveFormat(config) === 'native' && config.strict === false;
export const STRICT_IGNORED_NOTICE = 'Notice: strict mode applies to the decorators format only and is ignored with --format native, where attributes are typed with InferAttributes.';
```
### `src/builders/utils.ts` additions
```ts
export type PropertyValue = string | number | boolean | ts.Expression | PropertyValue[] | { [key: string]: PropertyValue };
export const isTsExpression = (value: unknown): value is ts.Expression => typeof value === 'object' && value !== null && 'kind' in value && ts.isExpression(value);
export const createPropertyValueExpression = (value: PropertyValue, isMultiLine: boolean): ts.Expression;
export const buildObjectLiteralExpression = (props: { [key: string]: PropertyValue }, isMultiLine: boolean): ts.ObjectLiteralExpression;
export const createTypeNodeFromName = (jsType: string): ts.TypeNode;  // number|string|boolean keywords, Date/Uint8Array refs, object keyword, else unknown
export const createNullableTypeNode = (type: ts.TypeNode): ts.TypeNode;
export const createGenericTypeReference = (name: string, args: ts.TypeNode[]): ts.TypeNode;
export const createIndexedAccessTypeNode = (modelName: string, attribute: string): ts.TypeNode;  // races["race_id"]
export const generateTypeOnlyImport = (importsSpecifier: string[], moduleSpecifier: string): ts.ImportDeclaration;  // createImportClause(ts.SyntaxKind.TypeKeyword, ...)
export const buildDataTypeExpression = (dataType: ISequelizeDataType, namespace: DataTypeNamespace): ts.Expression;
```
`generateObjectLiteralDecorator(decoratorIdentifier, props)` becomes a wrapper mapping values through `resolveDecoratorPropertyValue(value)` (the `DataType.`/`Sequelize.` sniff kept only for decorators) then `buildObjectLiteralExpression(mapped, false)`. Native never passes strings for `type`/`defaultValue`. `generateNamedImports` moves to `createImportClause(undefined, ...)`. Unit test: `nodeToString(buildDataTypeExpression(t, 'DataTypes'))` vs `renderDataTypeExpression` modulo `, ` spacing (native uses printer spacing `DataTypes.DECIMAL(7, 2)`).

### `src/builders/defaultValues.ts`
```ts
export type DefaultValueDescriptor = { kind: 'dataTypeMember'; member: string } | { kind: 'sqlLiteral'; sql: string } | { kind: 'number'; value: number } | { kind: 'boolean'; value: boolean } | { kind: 'string'; value: string };
export const parseDefaultValue = (raw: unknown): DefaultValueDescriptor | undefined;
export const buildDefaultValueExpression = (descriptor: DefaultValueDescriptor, namespace: DataTypeNamespace): ts.Expression;
```
### `src/builders/nativeAttributes.ts`
```ts
export const ATTRIBUTE_KINDS = ['plain', 'nullable', 'creationOptional', 'creationOptionalNullable', 'foreignKey', 'foreignKeyNullable'] as const;
export type AttributeKind = typeof ATTRIBUTE_KINDS[number];
export const isParanoidColumn = (column, table): boolean;      // table.paranoid && table.deletedAt === column.name
export const isCreationOptionalColumn = (column, table): boolean;   // autoIncrement || defaultValue !== undefined || isParanoidColumn
export const classifyAttribute = (column, table, isForeignKeyTargetGenerated: boolean): AttributeKind;
export const resolvePrimaryKeyAttribute = (table): string | undefined;   // exactly one primaryKey column
export const indexTablesByModelName = (tablesMetadata): ReadonlyMap<string, ITableMetadata>;
export const resolveForeignKeyTargetAttribute = (foreignKey: IColumnForeignKeyMetadata, target: ITableMetadata): string | undefined; // targetKey ?? single PK
export interface INativeIndex { name: string; isUnique: boolean; fields: string[]; using?: IndexMethod }
export const isPrimaryKeyIndex = (fields: readonly string[], primaryKeyColumns: readonly string[]): boolean;
export const collectTableIndexes = (table): INativeIndex[];
export const COLUMN_OPTION_KEYS = ['type', 'primaryKey', 'autoIncrement', 'allowNull', 'defaultValue', 'comment', 'field'] as const satisfies readonly (keyof ModelAttributeColumnOptions)[];
export const INIT_OPTION_KEYS = ['sequelize', 'tableName', 'freezeTableName', 'schema', 'timestamps', 'paranoid', 'deletedAt', 'hasTrigger', 'comment', 'indexes'] as const satisfies readonly (keyof InitOptions)[];
export const TIMESTAMP_ATTRIBUTES = ['createdAt', 'updatedAt'] as const;
```
### `src/builders/nativeAssociations.ts`
```ts
export const ASSOCIATION_METHODS = { HasOne: 'hasOne', HasMany: 'hasMany', BelongsTo: 'belongsTo', BelongsToMany: 'belongsToMany' } as const satisfies Record<IAssociationMetadata['associationName'], keyof typeof Model>;
export type AssociationWiringOptions = Partial<Pick<BelongsToOptions, 'as' | 'foreignKey' | 'targetKey' | 'onDelete' | 'onUpdate'>> & Partial<Pick<HasManyOptions, 'sourceKey'>> & Partial<Pick<BelongsToManyOptions, 'otherKey'>> & { throughModel?: string };
export interface INativeAssociationWiring { sourceModel: string; targetModel: string; method: ...; options: AssociationWiringOptions }
export const isToManyAssociation = (association): boolean;
export const resolveAssociationForeignKey = (source, association, tablesByModel): string | undefined;
export const resolveAssociationWiring = (source, association, tablesByModel): INativeAssociationWiring;
export interface IMixinDeclaration { propertyName: string; mixinTypeName: string; typeArguments: MixinTypeArgument[] }
export type MixinTypeArgument = { kind: 'model'; name: string } | { kind: 'attribute'; model: string; attribute: string } | { kind: 'literal'; value: string } | { kind: 'number' };
export const buildAssociationMixinDeclarations = (association, alias, targetPrimaryKeyAttribute, foreignKeyAttribute): IMixinDeclaration[];
export const collectSequelizeImports = (table, tablesByModel): string[];  // sorted, deterministic
export const collectModelTypeImports = (table, tablesByModel): string[];  // FK targets + association targets, minus self, minus non-generated
```
### `src/builders/NativeModelRenderer.ts`
`buildAttributeTypeNode`, `buildAttributeDeclaration`, `buildTimestampDeclarations`, `buildMixinDeclaration`, `buildIncludedAssociationDeclaration`, `buildStaticAssociationsDeclaration`, `buildColumnInitOptions`, `buildIndexLiteral`, `buildModelInitOptions`, `buildInitModelMethod`, `buildModelClassDeclaration`, `renderNativeModelFile(table, dialect, tablesByModel): string`, `renderNativeFiles(tablesMetadata, dialect): IGeneratedFile[]` (models + initModels.ts + index.ts).
### `src/builders/nativeWiring.ts`
`buildInitModelCall`, `buildAssociationCall`, `buildModelsReturn`, `buildInitModelsFunction`, `buildModelsTypeAlias`, `renderInitModelsFile`, `renderNativeIndexFile`.
### `src/builders/generatedFile.ts`
`export interface IGeneratedFile { fileName: string; content: string }`, `writeGeneratedFiles(outDir, files)`.
### `ModelBuilder.build()` dispatch (single entry, #82)
```ts
const format = resolveFormat(this.config);
if (shouldNoticeIgnoredStrict(this.config)) console.warn(STRICT_IGNORED_NOTICE);
// fetch metadata; zero tables -> warn and return (unchanged); ensure outDir; clean (unchanged)
const files = format === 'native' ? renderNativeFiles(tablesMetadata, this.dialect) : ModelBuilder.renderDecoratorsFiles(tablesMetadata, this.dialect, this.config.strict);
await writeGeneratedFiles(outDir, files);
// lint (unchanged)
if (format === 'decorators') warnWhenDecoratorsDependencyIsMissing(outDir);
```
`renderDecoratorsFiles` wraps existing `buildTableClassDeclaration` + `buildIndexExports` into `IGeneratedFile[]`; decorators node trees untouched. Replace `catch(err: any)` with `unknown` + `isErrnoException` guard.

## 3. Config and CLI
- `src/bin/utils.ts`: `aliasesMap.FORMAT: 'format'`; `buildConfig` adds `...(isFormat(argv[aliasesMap.FORMAT]) && { format: argv[aliasesMap.FORMAT] })`.
- `src/bin/cli.ts`: `.option('F', { alias: aliasesMap.FORMAT, string: true, choices: FORMATS, default: DEFAULT_FORMAT, describe: 'Output format:\n - native: plain Sequelize classes with declare fields, Model.init and an initModels wiring file (default)\n - decorators: sequelize-typescript decorators (requires sequelize-typescript in the target project)' })`; usage gains `-F [format]`. `-R` description: `Disable strict typescript class declaration (decorators format only; ignored in native format).`
- Notice printed once from `ModelBuilder.build()` when native and `strict === false`.
- `Builder` Postgres default schema unchanged.
- `src/index.ts`: export `FORMATS`, `DEFAULT_FORMAT`, `isFormat`, type `Format`.
- `src/tests/integration/formats.ts` re-exports from config.

## 4. Decorators dependency warning — `src/builders/decoratorsDependency.ts`
```ts
import { createRequire } from 'module';
export const DECORATORS_RUNTIME_PACKAGE = 'sequelize-typescript';
export const buildDecoratorsDependencyWarning = (outDir: string): string =>
    `Warning: --format decorators emits models that import "sequelize-typescript", but it cannot be resolved from ${outDir}. ` +
    `Install it in the target project: npm install sequelize-typescript reflect-metadata\n` +
    `Or use --format native (the default), which depends on sequelize only.`;
export const isPackageResolvableFrom = (packageName: string, directory: string): boolean => { const require = createRequire(import.meta.url); try { require.resolve(packageName, { paths: [directory] }); return true; } catch (err: unknown) { return !(isErrnoException(err) && err.code === 'MODULE_NOT_FOUND'); } };
export const warnWhenDecoratorsDependencyIsMissing = (outDir: string): void => { if (!isPackageResolvableFrom(DECORATORS_RUNTIME_PACKAGE, outDir)) console.warn(buildDecoratorsDependencyWarning(outDir)); };
```
Verify wording against #69's agreed block (read the issue) and adjust if it differs. Called at end of `build()` for decorators only; never throws. Unit test with `fs.mkdtemp` dir lacking the package; repo root resolves true. Move `isErrnoException` to `src/utils/errors.ts`.

## 5. Zero tables
Guard stays before the format dispatch. Unit test with a stub `Dialect` subclass whose `buildTablesMetadata` resolves `{}`: both formats warn once, nothing written, no dependency warning.

## 6. Lint
Default config format-neutral. Change `padded-blocks` to `{ blocks: 'never', classes: 'always', switches: 'always' }`; update README config block. Native passes `multiLine = true` for object literals. `--lint-file` path unchanged.

## 7. Tests
Unit: `config.test.ts`, `cliConfig.test.ts` (format mapping, `-R`), `builders.test.ts` (new helpers; decorators text unchanged), `defaultValues.test.ts`, `nativeAttributes.test.ts`, `nativeAssociations.test.ts`, `nativeModelRenderer.test.ts` (nodeToString snapshots for units, races, employees, data types incl. ENUM union and unknown, timestamps on/off, paranoid, --case field/deletedAt, MSSQL schema+hasTrigger, indexes), `nativeWiring.test.ts`, `decoratorsDependency.test.ts`, `modelBuilder.test.ts` zero-tables stub. `readmeProgrammaticExample.test.ts` keeps passing with updated fixture.

Integration (`TestRunner.ts`, both formats):
- `formats.ts` -> `['native', 'decorators']` via config re-export.
- Replace `import { Sequelize } from 'sequelize-typescript'` with base `sequelize`; `createTestConnection(format, options)` returns the sequelize-typescript subclass for decorators (needed for `addModels`), base for native; declared type base `Sequelize`. `ITestMetadata.ts` and `initTestDatabase` use base type.
- `registerGeneratedModels(connection, outDir, format)`: decorators -> `import(indexDir)` + `addModels(Object.values(models))` behind a subclass guard (replaces `// @ts-ignore`); native -> `const wiring: unknown = await import(path.join(outDir, 'initModels.ts')); if (hasInitModels(wiring)) wiring.initModels(connection)`. Used in Build, Data Types, Associations, Tables/Skip tables/Skip views (unlink stays only on decorators branch).
- `compileGeneratedModels(outDir, format)`; native options: strict, noEmit, target ES2022, module ESNext, moduleResolution Bundler, esModuleInterop, skipLibCheck, useDefineForClassFields true, types ['node'], no decorator flags.
- Case block: for native also register + `connection.isDefined(transformer(tableName, MODEL))`.
- Associations block: same `include` assertions; native-only mixin check (`typeof race.getUnits === 'function'`, `await race.getUnits()` length, `Object.keys(unitsModel.associations)` equals `['race']`).
- Phase 4/5 blocks run unchanged after `registerGeneratedModels`; phase 5 text assertions branch on format (native: `initModels.ts` contains `foreignKey: "race_id"` and no `onDelete` for the CSV pair).
- Golden: `npm run test:golden:update`, commit `sqlite/golden/native/*`. Decorators golden changes only from the SQLite allowNull fix.

## 8. README
Options/usage: `-F, --format`; `-R` decorators-only. New "Output formats" section: native default with excerpts + consumer snippet (`const models = initModels(sequelize); await models.units.findAll({ include: models.races })`), `Models` type, native-only note for `initModels`/`Models`/`static initModel`; decorators subsection with dependency warning and `sequelize.addModels`. "Strict mode": decorators only, notice in native. "Programmatic usage": example gains `format: 'native'`, drops `strict: true`; update `src/tests/unit/fixtures/readmeProgrammaticExample.ts` identically. "Lint": new `padded-blocks` value. Short migration hints. Prerequisites: sequelize-typescript/reflect-metadata only for decorators.

## 9. Release `13.0.0-beta.3`
`npm version 13.0.0-beta.3 --no-git-tag-version`, commit `v13 phase 6: bump version to 13.0.0-beta.3`. Human: tag + push (CI publish job, needs NPM_TOKEN) or `npm publish --access public --tag next`.

## 10. Ordered steps (one worker each; baseline verification `npx tsc --noEmit && npm run test:unit`)
0. Fix SQLite nullability (`allowNull: !column.notnull`), regenerate decorators golden, review flips. Commit: `v13 phase 6: fix inverted allowNull in the SQLite dialect`.
1. Format option (IConfig, format.ts, bin/utils, cli, index.ts, formats.ts re-export; tests). Commit: `v13 phase 6: add the format option to the configuration and CLI`.
2. Compiler-API helpers (`builders/utils.ts`, `defaultValues.ts`; tests; decorators golden unchanged). Commit: `v13 phase 6: add compiler-API helpers for type nodes, type-only imports and object literals`.
3. Descriptor layer (`nativeAttributes.ts`, `nativeAssociations.ts`; tests). Commit: `v13 phase 6: derive native attribute kinds, indexes and association wiring from metadata`.
4. Model renderer (`NativeModelRenderer.ts`; tests). Commit: `v13 phase 6: render native model files with the TypeScript compiler API`.
5. Wiring renderer (`nativeWiring.ts`, `generatedFile.ts`, `renderNativeFiles`; tests). Commit: `v13 phase 6: render the initModels wiring file and barrel`.
6. Dispatch + notices + warning (`ModelBuilder.build()`, `decoratorsDependency.ts`, `utils/errors.ts`, lint `blocks: 'never'`; tests; `npm run test:sqlite` decorators golden unchanged apart from step 0). Commit: `v13 phase 6: dispatch ModelBuilder on the output format and warn on a missing decorators dependency`.
7. Integration harness (both formats; native golden committed; all five dialects). Commit: `v13 phase 6: run the integration harness for both output formats`.
8. README + fixture. Commit: `v13 phase 6: document the native format and the format option`.
9. Version bump `13.0.0-beta.3`.

## Risks
- SQLite allowNull inversion fix is mandatory before native runtime tests.
- Mixin naming: Sequelize singularises `as` with `inflection`; we use `pluralize`; runtime assertions guard divergence.
- `declare` fields emit nothing under either `useDefineForClassFields`; renderer must never emit a non-`declare` field (TS2612).
- Circular `import type` erased; only value-import graph is `initModels.ts` -> models; `through: authors_books` needs junction `initModel` before wiring (statement order).
- `Model.init` completeness: derive class attributes and init entries from the same column list plus `TIMESTAMP_ATTRIBUTES`.
- `--case`: `deletedAt` option is attribute name; `indexes.fields` are database column names; `ForeignKey<Races["raceId"]>` uses transformed target key; target lookup by model name.
- Postgres serial columns emit both `autoIncrement: true` and `defaultValue: Sequelize.literal("nextval(...)")`, as decorators do.
- MSSQL suite needs Node <= 23.
