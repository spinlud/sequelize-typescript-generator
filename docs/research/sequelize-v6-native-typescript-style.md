# Sequelize v6 (6.37.x) native TypeScript model style without decorators

## Question

GitHub issue spinlud/sequelize-typescript-generator#63: what is the exact, officially
documented Sequelize v6 (6.37.x) TypeScript model style WITHOUT decorators? This covers the
`declare` + `InferAttributes` / `InferCreationAttributes` class style, the branded helper types
(`CreationOptional`, `ForeignKey`, `NonAttribute`), the `Model.init(attributes, options)` shape,
how associations are declared and typed, the data-type mappings relevant to a generator, and the
TypeScript / Node versions Sequelize 6.37.x officially supports.

All facts below come from the Sequelize v6 documentation site and the `v6` branch of
`github.com/sequelize/sequelize` (the published package is `sequelize@6.37.8` as of the research
date; the `v6` branch `package.json` carries the placeholder version `0.0.0-development` because
semantic-release stamps the real version at publish time).

## Summary

- The official style is a class `extends Model<InferAttributes<User>, InferCreationAttributes<User>>` whose attributes are written as `declare id: CreationOptional<number>;` (never as public class fields). Source: https://sequelize.org/docs/v6/other-topics/typescript/
- `declare` is mandatory: "Models need properties declared with the `declare` keyword rather than public class fields. This ensures TypeScript doesn't emit those properties as actual class fields" (which would shadow Sequelize's getters/setters). Source: https://sequelize.org/docs/v6/other-topics/typescript/
- `InferAttributes<M, { omit: 'a' | 'b' }>` excludes properties by name; `InferAttributes` also automatically drops Model-inherited members, functions, and `NonAttribute`-branded fields. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts
- `CreationOptional<T>` marks attributes optional in `create()`/`build()` (autoIncrement PKs, timestamps, columns with defaults). Nullable attributes are typed `string | null` and need no `CreationOptional` because "nullable attributes are always optional in User.create()". Source: https://sequelize.org/docs/v6/other-topics/typescript/
- `ForeignKey<T>` brands foreign-key attributes so they can be omitted from the `Model.init` attributes object (they are added by association methods); `NonAttribute<T>` tags getters and eagerly-loaded association properties. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts
- Association mixins are declared virtually: `declare getProjects: HasManyGetAssociationsMixin<Project>;`, `declare createProject: HasManyCreateAssociationMixin<Project, 'ownerId'>;`, plus `declare static associations: { projects: Association<User, Project> };`. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts
- Associations are wired after `init` with `User.hasMany(Project, { sourceKey: 'id', foreignKey: 'ownerId', as: 'projects' })`; the `as` alias "determines the name in `associations`" and the mixin method names. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts
- `Model.init` signature: `init(this: MS, attributes: ModelAttributes<M, Optional<Attributes<M>, BrandedKeysOf<Attributes<M>, typeof ForeignKeyBrand>>>, options: InitOptions<M>): MS` and `InitOptions` = `ModelOptions & { sequelize: Sequelize }` ("Required ATM"). Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts
- Column options (`ModelAttributeColumnOptions`): `type`, `allowNull`, `field`, `defaultValue`, `unique: boolean | string | { name; msg }`, `primaryKey`, `autoIncrement`, `autoIncrementIdentity`, `comment`, `references: string | { model, key, deferrable }`, `onUpdate`, `onDelete`, `values`, `get`/`set`, `validate`. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts
- Model options: `modelName`, `tableName`, `schema`, `timestamps`, `createdAt`/`updatedAt`/`deletedAt: string | boolean`, `underscored`, `paranoid`, `freezeTableName`, `indexes`, `comment`, `charset`, `collate`, `engine`, `version`, `name`, `hooks`, `validate`, `defaultScope`, `scopes`. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts
- Index entries (`IndexesOptions`): `name`, `unique`, `fields` (string or `{ name, length, order, collate, operator }`), `using: 'BTREE' | 'HASH' | 'GIST' | 'SPGIST' | 'GIN' | 'BRIN' | string`, `type` (MySQL `UNIQUE`/`FULLTEXT`/`SPATIAL`), `operator`, `concurrently`, `where`, `parser`, `prefix`. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/abstract/query-interface.d.ts
- `DataTypes.ENUM` is generic over string literal members (`EnumDataTypeConstructor.<T extends string>(...values: T[])`); `DataTypes.ARRAY(DataTypes.STRING)`, `RANGE`, `JSON`/`JSONB`, `CITEXT`, `TSVECTOR`, `GEOMETRY(type, srid)`, `GEOGRAPHY`, `VIRTUAL(returnType, fields)` are all typed in `data-types.d.ts`. Sequelize v6 typings do not import or export any GeoJSON type. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts
- GEOMETRY/GEOGRAPHY: "GeoJSON is accepted as input and returned as output"; on PostgreSQL the parser returns `wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true })`. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.js
- On PostgreSQL `DECIMAL.parse(value)` returns the value unchanged (the driver's string) and `BIGINT` defines no parser, so `int8`/`numeric` values arrive as strings; only `INTEGER.parse` calls `parseInt`. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/postgres/data-types.js
- Supported versions: docs say "only TypeScript >= 4.1 is supported" and the releases table lists Sequelize 6 with Node ">= 10" and TypeScript ">= 4.1"; `package.json` on `v6` has `engines.node: ">=10.0.0"`, `typescript: "^4.5.4"`, `@types/node: "^16.11.17"`, and CI tests TS 4.1 through 5.2 on Node 10 and 18. Sources: https://sequelize.org/releases/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/package.json , https://raw.githubusercontent.com/sequelize/sequelize/v6/.github/workflows/ci.yml

## 1. Class style: `declare` fields with `InferAttributes` / `InferCreationAttributes`

The TypeScript guide states that "only TypeScript >= 4.1 is supported" and that TypeScript
support "doesn't follow SemVer" (a TS release is supported for roughly one year before it can be
dropped in a minor). It also requires installing `@types/node` manually because it is not bundled.
Source: https://sequelize.org/docs/v6/other-topics/typescript/

The reference example (the docs page is kept in sync with the type-test file
`test/types/typescriptDocs/ModelInit.ts`) is:

```ts
import {
  Association, DataTypes, HasManyAddAssociationMixin, HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin, HasManyGetAssociationsMixin, HasManyHasAssociationMixin,
  HasManySetAssociationsMixin, HasManyAddAssociationsMixin, HasManyHasAssociationsMixin,
  HasManyRemoveAssociationMixin, HasManyRemoveAssociationsMixin, Model, ModelDefined, Optional,
  Sequelize, InferAttributes, InferCreationAttributes, CreationOptional, NonAttribute, ForeignKey,
} from 'sequelize';

// 'projects' is excluded as it's not an attribute, it's an association.
class User extends Model<InferAttributes<User, { omit: 'projects' }>, InferCreationAttributes<User, { omit: 'projects' }>> {
  // id can be undefined during creation when using `autoIncrement`
  declare id: CreationOptional<number>;
  declare name: string;
  declare preferredName: string | null; // for nullable fields

  // createdAt can be undefined during creation
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  // Since TS cannot determine model association at compile time
  // we have to declare them here purely virtually
  // these will not exist until `Model.init` was called.
  declare getProjects: HasManyGetAssociationsMixin<Project>;
  declare addProject: HasManyAddAssociationMixin<Project, number>;
  declare addProjects: HasManyAddAssociationsMixin<Project, number>;
  declare setProjects: HasManySetAssociationsMixin<Project, number>;
  declare removeProject: HasManyRemoveAssociationMixin<Project, number>;
  declare removeProjects: HasManyRemoveAssociationsMixin<Project, number>;
  declare hasProject: HasManyHasAssociationMixin<Project, number>;
  declare hasProjects: HasManyHasAssociationsMixin<Project, number>;
  declare countProjects: HasManyCountAssociationsMixin;
  declare createProject: HasManyCreateAssociationMixin<Project, 'ownerId'>;

  // You can also pre-declare possible inclusions, these will only be populated if you
  // actively include a relation.
  declare projects?: NonAttribute<Project[]>;

  // getters that are not attributes should be tagged using NonAttribute
  get fullName(): NonAttribute<string> {
    return this.name;
  }

  declare static associations: {
    projects: Association<User, Project>;
  };
}

class Project extends Model<InferAttributes<Project>, InferCreationAttributes<Project>> {
  declare id: CreationOptional<number>;

  // foreign keys are automatically added by associations methods (like Project.belongsTo)
  // by branding them using the `ForeignKey` type, `Project.init` will know it does not need to
  // display an error if ownerId is missing.
  declare ownerId: ForeignKey<User['id']>;
  declare name: string;

  // `owner` is an eagerly-loaded association. We tag it as `NonAttribute`
  declare owner?: NonAttribute<User>;

  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts
(mirrored at https://sequelize.org/docs/v6/other-topics/typescript/ )

Key rules from the guide:

- `declare` keyword: models "need properties declared with the `declare` keyword rather than
  public class fields. This ensures TypeScript doesn't emit those properties as actual class
  fields." Source: https://sequelize.org/docs/v6/other-topics/typescript/
- `InferAttributes` / `InferCreationAttributes` "exclude static fields, methods, properties marked
  with `NonAttribute`, and properties listed in an `omit` option."
  Source: https://sequelize.org/docs/v6/other-topics/typescript/
- Nullable fields: `declare preferredName: string | null;` with `allowNull: true` in `init`; there is
  "no need to use CreationOptional on lastName because nullable attributes are always optional in
  User.create()". Source: https://sequelize.org/docs/v6/other-topics/typescript/
- Included associations are not knowable at compile time, so the docs use `ourUser.projects![0]`
  (non-null assertion) or optional chaining when reading them.
  Source: https://sequelize.org/docs/v6/other-topics/typescript/

### The utility types as declared in `src/model.d.ts` (branch `v6`)

```ts
export abstract class Model<TModelAttributes extends {} = any, TCreationAttributes extends {} = TModelAttributes>

/** Option bag for {@link InferAttributes}. - omit: properties to not treat as Attributes. */
type InferAttributesOptions<Excluded, > = { omit?: Excluded };

export type InferAttributes<
  M extends Model,
  Options extends InferAttributesOptions<keyof M | never | ''> = { omit: never }
  > = {
  [Key in keyof M as InternalInferAttributeKeysFromFields<M, Key, Options>]: M[Key]
};

export type InferCreationAttributes<
  M extends Model,
  Options extends InferAttributesOptions<keyof M | never | ''> = { omit: never }
  > = {
  [Key in keyof M as InternalInferAttributeKeysFromFields<M, Key, Options>]: IsBranded<M[Key], typeof CreationAttributeBrand> extends true
    ? (M[Key] | undefined)
    : M[Key]
};

export type CreationOptional<T> = T extends null | undefined ? T : (T & { [CreationAttributeBrand]?: true });
export type ForeignKey<T>       = T extends null | undefined ? T : (T & { [ForeignKeyBrand]?: true });
export type NonAttribute<T>     = T extends null | undefined ? T : (T & { [NonAttributeBrand]?: true });

export type Attributes<M extends Model | Hooks> = M['_attributes'];
export type CreationAttributes<M extends Model | Hooks> = MakeNullishOptional<M['_creationAttributes']>;
export type ModelStatic<M extends Model> = NonConstructor<typeof Model> & { new(): M };
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts

The JSDoc on `InferAttributes` says it returns all instance properties "except: those inherited
from Model (intermediate inheritance works), the ones whose type is a function, the ones manually
excluded using the second parameter, the ones branded using NonAttribute" and warns "It cannot
detect whether something is a getter or not, you should use the `Excluded` parameter to exclude
getter & setters" (or brand the getter's return type with `NonAttribute`). Its examples show both
`Model<InferAttributes<User, { omit: 'name' | 'projects' }>>` and the `NonAttribute` alternative.
The branded types explicitly support nullable unions: "`CreationOptional<string | null>` does work!"
(same note for `ForeignKey` and `NonAttribute`).
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts

### `sequelize.define` variant (interface style)

```ts
interface UserModel extends Model<InferAttributes<UserModel>, InferCreationAttributes<UserModel>> {
  id: CreationOptional<number>;
  name: string;
}
const UserModel = sequelize.define<UserModel>('User', {
  id: { primaryKey: true, type: DataTypes.INTEGER.UNSIGNED },
  name: { type: DataTypes.STRING },
});
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/Define.ts

The docs also keep a legacy functional form using `interface NoteAttributes`,
`type NoteCreationAttributes = Optional<NoteAttributes, 'id' | 'title'>` and
`const Note: ModelDefined<NoteAttributes, NoteCreationAttributes> = sequelize.define(...)`, where
`Optional<T, K> = Omit<T, K> & Partial<Pick<T, K>>` is exported from `sequelize`.
Sources: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts ,
https://raw.githubusercontent.com/sequelize/sequelize/v6/src/index.d.ts

### Loose variant without attribute generics

`class User extends Model { declare id: number; declare name: string; declare preferredName: string | null; }`
is documented as "Usage without strict types for attributes"; it compiles but gives up type
checking of the `init` attributes object and of `create()` payloads.
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInitNoAttributes.ts

## 2. `Model.init(attributes, options)`

```ts
public static init<MS extends ModelStatic<Model>, M extends InstanceType<MS>>(
  this: MS,
  attributes: ModelAttributes<
    M,
    // 'foreign keys' are optional in Model.init as they are added by association declaration methods
    Optional<Attributes<M>, BrandedKeysOf<Attributes<M>, typeof ForeignKeyBrand>>
  >,
  options: InitOptions<M>
): MS;

export type ModelAttributes<M extends Model = Model, TAttributes = any> = {
  [name in keyof TAttributes]: DataType | ModelAttributeColumnOptions<M>;
}

export interface InitOptions<M extends Model = Model> extends ModelOptions<M> {
  /** The sequelize connection. Required ATM. */
  sequelize: Sequelize;
}
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts

Consequences for a generator: every key of `InferAttributes<M>` that is not `ForeignKey`-branded
MUST appear in the `init` attributes object (the compiler errors otherwise), and each value can be
a bare `DataType` shorthand (`createdAt: DataTypes.DATE`) or a full column-options object. The
model-basics guide confirms the shorthand: `sequelize.define('User', { name: DataTypes.STRING })`.
Source: https://sequelize.org/docs/v6/core-concepts/model-basics/

### Column options (`ModelAttributeColumnOptions extends ColumnOptions`)

```ts
allowNull?: boolean;                 // "If false, the column will have a NOT NULL constraint" (default true)
field?: string;                      // map the attribute name to a different column name
defaultValue?: unknown;              // literal, JS function, or SQL function (sequelize.fn)
type: DataType;                      // "A string or a data type"
unique?: boolean | string | { name: string; msg: string }; // string => composite unique index shared by same-named columns
primaryKey?: boolean;
autoIncrement?: boolean;
autoIncrementIdentity?: boolean;     // Postgres 10+: GENERATED BY DEFAULT AS IDENTITY instead of SERIAL
comment?: string;
references?: string | ModelAttributeColumnReferencesOptions; // { model?: TableName | ModelType; key?: string; deferrable?: Deferrable }
onUpdate?: string;                   // CASCADE, RESTRICT, SET DEFAULT, SET NULL or NO ACTION
onDelete?: string;                   // same set
values?: readonly string[];          // ENUM values
get?(this: M): unknown; set?(this: M, val: unknown): void;
validate?: ModelValidateOptions;
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts

The model-basics guide's `Foo.init` example demonstrates the same set in JS
(`unique: 'compositeIndex'`, `field: 'field_with_underscores'`, `references: { model: Bar, key: 'id' }`,
`comment: 'This is a column name that has a comment'`, `defaultValue: DataTypes.NOW`).
Source: https://sequelize.org/docs/v6/core-concepts/model-basics/

### Model options (`ModelOptions<M>`)

| Option | Type / doc comment |
| --- | --- |
| `modelName` | `string` - "Set name of the model. By default its same as Class name." |
| `tableName` | `string` - default "pluralized model name, unless freezeTableName is true" |
| `freezeTableName` | `boolean` - do not pluralize; default false |
| `schema` | `string` |
| `timestamps` | `boolean` - "Adds createdAt and updatedAt timestamps to the model. Default true." |
| `createdAt` / `updatedAt` / `deletedAt` | `string \| boolean` - "Override the name ... if a string is provided, or disable it if false. Timestamps must be true. Not affected by underscored setting." |
| `underscored` | `boolean` - "Converts all camelCased columns to underscored if true. Default false." |
| `paranoid` | `boolean` - soft delete via deletedAt; "Needs timestamps=true to work. Default false." |
| `indexes` | `readonly ModelIndexesOptions[]` (`ModelIndexesOptions = IndexesOptions`) |
| `comment` | `string` - table comment "in MySQL and PG" |
| `charset` / `collate` / `engine` | `string` |
| `initialAutoIncrement` | `string` - MySQL initial AUTO_INCREMENT |
| `version` | `boolean \| string` - optimistic locking column (`version` when true) |
| `name` | `{ singular, plural }` used when associated |
| `hooks`, `validate`, `defaultScope`, `scopes`, `omitNull`, `setterMethods`, `getterMethods`, `whereMergeStrategy` | see source |

Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts

Docs prose: "By default, Sequelize automatically adds the fields `createdAt` and `updatedAt` to
every model"; you can "enable only one of createdAt/updatedAt, and provide a custom name for these
columns" (`createdAt: 'creation_date'`, `updatedAt: false`).
Source: https://sequelize.org/docs/v6/core-concepts/model-basics/

### Indexes

```js
indexes: [
  { unique: true, fields: ['email'] },                        // unique index
  { fields: ['data'], using: 'gin', operator: 'jsonb_path_ops' },
  { name: 'public_by_author', fields: ['author', 'status'], where: { status: 'public' } },
  { name: 'title_index', using: 'BTREE',
    fields: ['author', { name: 'title', collate: 'en_US', order: 'DESC', length: 5 }] },
]
```
"By default index name will be [table]_[fields]".
Source: https://sequelize.org/docs/v6/other-topics/indexes/

Typed shape:

```ts
export type IndexMethod = 'BTREE' | 'HASH' | 'GIST' | 'SPGIST' | 'GIN' | 'BRIN' | string;
export interface IndexesOptions {
  name?: string;            // "Defaults to model name + _ + fields concatenated"
  parser?: string | null;   // FULLTEXT parser
  type?: IndexType;         // MySQL only: UNIQUE, FULLTEXT, SPATIAL
  unique?: boolean;
  concurrently?: boolean;   // Postgres only
  fields?: (string | { name: string; length?: number; order?: 'ASC' | 'DESC'; collate?: string; operator?: string } | Fn | Literal)[];
  using?: IndexMethod;
  operator?: string;        // Postgres only
  where?: WhereOptions<any>;
  prefix?: string;
}
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/abstract/query-interface.d.ts

## 3. Associations: declaration and typing

### Runtime declaration (after `init`)

```ts
User.hasMany(Project, {
  sourceKey: 'id',
  foreignKey: 'ownerId',
  as: 'projects' // this determines the name in `associations`!
});
Address.belongsTo(User, { targetKey: 'id' });
User.hasOne(Address, { sourceKey: 'id' });
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts

Static signatures:

```ts
public static hasOne<M extends Model, T extends Model>(this: ModelStatic<M>, target: ModelStatic<T>, options?: HasOneOptions): HasOne<M, T>;
public static belongsTo<M extends Model, T extends Model>(this: ModelStatic<M>, target: ModelStatic<T>, options?: BelongsToOptions): BelongsTo<M, T>;
public static hasMany<M extends Model, T extends Model>(this: ModelStatic<M>, target: ModelStatic<T>, options?: HasManyOptions): HasMany<M, T>;
public static belongsToMany<M extends Model, T extends Model>(this: ModelStatic<M>, target: ModelStatic<T>, options: BelongsToManyOptions): BelongsToMany<M, T>;
public static readonly associations: { [key: string]: Association };
```
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts

Option semantics (assocs guide + `associations/*.d.ts`):

- `as?: string | { singular: string; plural: string }` - alias; "Defaults to the singularized name of
  target". `Ship.belongsTo(Captain, { as: 'leader' })` renames the FK to `leaderId` and the mixins to
  `getLeader()` etc. Sources: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/base.d.ts , https://sequelize.org/docs/v6/core-concepts/assocs/
- `foreignKey?: string | ForeignKeyOptions` (`ForeignKeyOptions extends ColumnOptions { name?: string }`,
  so `{ name: 'myFooId', type: DataTypes.UUID, allowNull: false }` is allowed). "Defaults to the name
  of source + primary key of source". Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/base.d.ts
- `onDelete` default `'SET NULL'` for 1:1 / 1:m and `'CASCADE'` for n:m; `onUpdate` default
  `'CASCADE'`; `constraints` / `foreignKeyConstraint` toggle FK constraints.
  Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/base.d.ts
- `HasOneOptions` / `HasManyOptions`: `sourceKey?: string` (default source PK), `keyType?: DataType`.
  `BelongsToOptions`: `targetKey?: string` (default target PK), `keyType`.
  Sources: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/has-one.d.ts , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/has-many.d.ts , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/belongs-to.d.ts
- `BelongsToManyOptions`: `through: ModelType | string | ThroughOptions` (required), `otherKey?: string | ForeignKeyOptions`
  ("Defaults to the name of target + primary key of target"), `sourceKey`, `targetKey`, `timestamps`,
  `uniqueKey`; `ThroughOptions = { model, paranoid?, scope?, unique? }`.
  Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/belongs-to-many.d.ts
- Non-PK targets: `Ship.belongsTo(Captain, { targetKey: 'name', foreignKey: 'captainName' })`,
  `Foo.hasOne(Bar, { sourceKey: 'name', foreignKey: 'fooName' })`,
  `Foo.belongsToMany(Bar, { through: 'foo_bar', sourceKey: 'name', targetKey: 'title' })`.
  Source: https://sequelize.org/docs/v6/core-concepts/assocs/

### `Association<S, T>` (for `declare static associations`)

```ts
export abstract class Association<S extends Model = Model, T extends Model = Model> {
  public associationType: string;
  public source: ModelCtor<S>;
  public target: ModelCtor<T>;
  public isSelfAssociation: boolean;
  public isSingleAssociation: boolean;
  public isMultiAssociation: boolean;
  public as: string;
  public isAliased: boolean;
  public foreignKey: string;
  public identifier: string;
}
```
Subclasses `HasOne<S,T>`, `BelongsTo<S,T>`, `HasMany<S,T>`, `BelongsToMany<S,T>` are also exported and
can be used instead of the base `Association<S,T>` for more precise typing.
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/base.d.ts

### Mixin types (one `declare` per generated instance method)

| Association | Mixins (generic params) |
| --- | --- |
| hasOne | `HasOneGetAssociationMixin<TModel>`, `HasOneSetAssociationMixin<TModel, TPrimaryKey>`, `HasOneCreateAssociationMixin<TModel extends Model>` |
| belongsTo | `BelongsToGetAssociationMixin<TModel>`, `BelongsToSetAssociationMixin<TModel, TPrimaryKey>`, `BelongsToCreateAssociationMixin<TModel extends Model>` |
| hasMany | `HasManyGetAssociationsMixin<TModel>`, `HasManySetAssociationsMixin<TModel, TPk>`, `HasManyAddAssociationsMixin<TModel, TPk>`, `HasManyAddAssociationMixin<TModel, TPk>`, `HasManyCreateAssociationMixin<TModel, TForeignKey = never, TScope = never>`, `HasManyRemoveAssociationMixin<TModel, TPk>`, `HasManyRemoveAssociationsMixin<TModel, TPk>`, `HasManyHasAssociationMixin<TModel, TPk>`, `HasManyHasAssociationsMixin<TModel, TPk>`, `HasManyCountAssociationsMixin` |
| belongsToMany | same ten names with the `BelongsToMany` prefix; `BelongsToManyCreateAssociationMixin<TModel extends Model>` takes `CreationAttributes<TModel>`; set/add mixins accept a `through` option for join-table attributes |

Sample signatures:

```ts
export type HasManyGetAssociationsMixin<TModel> = (options?: HasManyGetAssociationsMixinOptions) => Promise<TModel[]>;
export type HasManyAddAssociationMixin<TModel, TModelPrimaryKey> = (
  newAssociation?: TModel | TModelPrimaryKey, options?: HasManyAddAssociationMixinOptions) => Promise<void>;
export type HasManyCreateAssociationMixin<
  TModel extends Model,
  TForeignKey extends keyof CreationAttributes<TModel> = never,
  TScope extends keyof CreationAttributes<TModel> = never
> = (values?: Omit<CreationAttributes<TModel>, TForeignKey | TScope>, options?: HasManyCreateAssociationMixinOptions) => Promise<TModel>;
export type HasManyCountAssociationsMixin = (options?: HasManyCountAssociationsMixinOptions) => Promise<number>;
export type BelongsToGetAssociationMixin<TModel> = (options?: BelongsToGetAssociationMixinOptions) => Promise<TModel>;
export type BelongsToSetAssociationMixin<TModel, TPrimaryKey> = (newAssociation?: TModel | TPrimaryKey, options?: BelongsToSetAssociationMixinOptions) => Promise<void>;
export type HasOneGetAssociationMixin<TModel> = (options?: HasOneGetAssociationMixinOptions) => Promise<TModel>;
```
Sources: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/has-many.d.ts ,
https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/belongs-to.d.ts ,
https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/has-one.d.ts ,
https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/belongs-to-many.d.ts

Method naming per the assocs guide: hasOne/belongsTo generate `getX`, `setX`, `createX`;
hasMany/belongsToMany generate `getXs`, `countXs`, `hasX`, `hasXs`, `setXs`, `addX`, `addXs`,
`removeX`, `removeXs`, `createX`, where X is the (singular/plural) alias or target model name.
Source: https://sequelize.org/docs/v6/core-concepts/assocs/

Eagerly loaded association properties are declared optional and `NonAttribute`-branded
(`declare projects?: NonAttribute<Project[]>;`, `declare owner?: NonAttribute<User>;`) or listed in
`omit`, so that they are not required in `init` nor in `create()`.
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts

## 4. Data type mappings relevant to generated TypeScript

Every DataType is exported both individually and via the `DataTypes` namespace object
(`export * from './data-types'` and `export { ..., DataTypes, ... }`), so `import { DataTypes } from 'sequelize'`
is the documented form. `type DataType = string | AbstractDataTypeConstructor | AbstractDataType`.
Sources: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/index.d.ts , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts

| Sequelize type | Declaration form | Notes / TS value type used in docs |
| --- | --- | --- |
| STRING / TEXT / CITEXT / TSVECTOR | `DataTypes.STRING`, `DataTypes.STRING(1234)`, `new DataTypes.STRING(128)`, `DataTypes.STRING.BINARY`, `DataTypes.TEXT`, `DataTypes.TEXT('tiny')`, `DataTypes.CITEXT` (PostgreSQL and SQLite only), `DataTypes.TSVECTOR` (PostgreSQL only) | `string` (`string \| null` when nullable). Source: https://sequelize.org/docs/v6/core-concepts/model-basics/ |
| BOOLEAN | `DataTypes.BOOLEAN` | `boolean` |
| INTEGER / BIGINT | `DataTypes.INTEGER`, `DataTypes.INTEGER.UNSIGNED`, `DataTypes.BIGINT`, `DataTypes.BIGINT(11)` | docs type `id: CreationOptional<number>` for `INTEGER.UNSIGNED` PKs. On PostgreSQL, `BIGINT` (`int8`) has no `parse` override while `INTEGER.parse = parseInt`, so int8 values are whatever the `pg` driver returns (strings by default). Sources: https://sequelize.org/docs/v6/other-topics/typescript/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/postgres/data-types.js |
| DECIMAL / FLOAT / DOUBLE / REAL | `DataTypes.DECIMAL(10, 2)`, `DataTypes.FLOAT(11, 10)`, `DataTypes.DOUBLE`, `DataTypes.REAL` (PostgreSQL only) | PostgreSQL `DECIMAL.parse(value) { return value; }` passes the driver's string through unchanged (`numeric` OID), so DECIMAL is received as `string` on Postgres. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/postgres/data-types.js |
| DATE / DATEONLY | `DataTypes.DATE` ("DATETIME for mysql / sqlite, TIMESTAMP WITH TIME ZONE for postgres"), `DataTypes.DATE(6)`, `DataTypes.DATEONLY` ("DATE without time") | `Date` in the docs (`createdAt: CreationOptional<Date>`). Source: https://sequelize.org/docs/v6/core-concepts/model-basics/ |
| UUID | `{ type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 }` (or `UUIDV1`) | `string`. Source: https://sequelize.org/docs/v6/core-concepts/model-basics/ |
| BLOB | `DataTypes.BLOB`, `DataTypes.BLOB('tiny' \| 'medium' \| 'long')` | accepts strings or buffers, "always retrieved as a buffer" (`Buffer`). Source: https://sequelize.org/docs/v6/other-topics/other-data-types/ |
| ENUM | `DataTypes.ENUM('foo', 'bar')` or `{ type: DataTypes.ENUM, values: ['active', 'pending', 'deleted'] }` | `EnumDataTypeConstructor` is `<T extends string>(...values: T[]): EnumDataType<T>`, i.e. the members are string literals; the docs do not prescribe a TS attribute type, so a union `'foo' \| 'bar'` (or `string`) is the natural attribute type. Sources: https://sequelize.org/docs/v6/other-topics/other-data-types/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts |
| JSON / JSONB | `DataTypes.JSON` ("only supported for SQLite, MySQL, MariaDB, Oracle and PostgreSQL"), `DataTypes.JSONB` (PostgreSQL) | typed `AbstractDataTypeConstructor`; no value type is prescribed (docs query nested keys as plain objects). Sources: https://sequelize.org/docs/v6/other-topics/other-data-types/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts |
| ARRAY | `DataTypes.ARRAY(DataTypes.STRING)` (`VARCHAR(255)[]`), nested `ARRAY(ARRAY(STRING))`; PostgreSQL only | `ArrayDataTypeConstructor<T extends AbstractDataTypeConstructor \| AbstractDataType>(type: T)` -> attribute typed `string[]` etc. Sources: https://sequelize.org/docs/v6/other-topics/other-data-types/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts |
| RANGE | `DataTypes.RANGE(DataTypes.INTEGER \| BIGINT \| DATE \| DATEONLY \| DECIMAL)`; PostgreSQL only | values are read back as `[{ value, inclusive }, { value, inclusive }]`; `RangeableDataType` restricts the subtype. Sources: https://sequelize.org/docs/v6/other-topics/other-data-types/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts |
| GEOMETRY / GEOGRAPHY | `DataTypes.GEOMETRY`, `DataTypes.GEOMETRY('POINT')`, `DataTypes.GEOMETRY('POINT', 4326)`, `DataTypes.GEOMETRY('POLYGON')`, `DataTypes.GEOMETRY('LINESTRING')`, `DataTypes.GEOGRAPHY` (PostgreSQL/PostGIS; GEOMETRY also MariaDB/MySQL) | "GeoJSON is accepted as input and returned as output" (`{ type: 'Point', coordinates: [-76.984722, 39.807222] }`, optional `crs`); the Postgres parser returns `wkx.Geometry.parse(b).toGeoJSON({ shortCrs: true })`. `data-types.d.ts` contains no GeoJSON import, so a generator must supply its own type (e.g. `@types/geojson`'s `Geometry`/`Point`) or use `object`. Sources: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.js , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/postgres/data-types.js , https://sequelize.org/docs/v6/other-topics/other-data-types/ |
| VIRTUAL | `{ type: DataTypes.VIRTUAL, get() {...}, set(value) {...} }` or `new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt'])` | "The VIRTUAL field does not cause a column in the table to exist"; `VirtualDataType<T> { returnType: T; fields: string[] }`. Sources: https://sequelize.org/docs/v6/core-concepts/getters-setters-virtuals/ , https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts |
| HSTORE / CIDR / INET / MACADDR | `DataTypes.HSTORE` (needs `pg-hstore`), `DataTypes.CIDR`, `DataTypes.INET`, `DataTypes.MACADDR`; PostgreSQL only | Source: https://sequelize.org/docs/v6/other-topics/other-data-types/ |

`GeometryDataTypeConstructor`/`GeographyDataTypeConstructor` accept `(type: string, srid?: number)` or
`({ type, srid })`; `EnumDataTypeOptions<T> { values: T[] }`; `ArrayDataTypeOptions<T> { type: T }`;
`RangeDataTypeOptions<T> { subtype?: T }`.
Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts

## 5. Officially supported TypeScript and Node versions (Sequelize 6.37.x)

- Releases page table, row "Sequelize 6 (current)": Node.js ">= 10", TypeScript ">= 4.1", released
  2020-06-24, EOL undetermined. Source: https://sequelize.org/releases/
- TypeScript guide: "only TypeScript >= 4.1 is supported"; TS support does not follow SemVer and a TS
  release may be dropped in a minor about a year after its release.
  Source: https://sequelize.org/docs/v6/other-topics/typescript/
- `package.json` on branch `v6`: `"engines": { "node": ">=10.0.0" }`, `"types": "./types/index.d.ts"`,
  devDependencies `"typescript": "^4.5.4"`, `"@types/node": "^16.11.17"`; runtime dependencies
  include `@types/debug` and `@types/validator` (so the published typings resolve); all DB drivers are
  optional peer dependencies. Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/package.json
- Published `sequelize@latest` on npm is `6.37.8` with the same `engines`, `types`, `typescript`
  and `@types/node` values. Source: https://registry.npmjs.org/sequelize/latest
- CI on `v6` runs the typing tests against `ts-version: ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "5.0", "5.1", "5.2"]`
  and the integration suites on `node-version: [10, 18]`.
  Source: https://raw.githubusercontent.com/sequelize/sequelize/v6/.github/workflows/ci.yml
- The `getting-started` page does not state a Node version; it only lists the drivers to install
  (`pg pg-hstore`, `mysql2`, `mariadb`, `sqlite3`, `tedious`, `oracledb`) and the dialect list
  `mysql | postgres | sqlite | mariadb | mssql | db2 | snowflake | oracle`.
  Source: https://sequelize.org/docs/v6/getting-started/

## Sources

- https://sequelize.org/docs/v6/other-topics/typescript/
- https://sequelize.org/docs/v6/core-concepts/model-basics/
- https://sequelize.org/docs/v6/core-concepts/assocs/
- https://sequelize.org/docs/v6/core-concepts/getters-setters-virtuals/
- https://sequelize.org/docs/v6/other-topics/other-data-types/
- https://sequelize.org/docs/v6/other-topics/indexes/
- https://sequelize.org/docs/v6/getting-started/
- https://sequelize.org/releases/
- https://raw.githubusercontent.com/sequelize/sequelize/v6/package.json
- https://raw.githubusercontent.com/sequelize/sequelize/v6/.github/workflows/ci.yml
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/index.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/model.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/data-types.js
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/postgres/data-types.js
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/dialects/abstract/query-interface.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/base.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/has-one.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/has-many.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/belongs-to.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/src/associations/belongs-to-many.d.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInit.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/Define.ts
- https://raw.githubusercontent.com/sequelize/sequelize/v6/test/types/typescriptDocs/ModelInitNoAttributes.ts
- https://registry.npmjs.org/sequelize/latest

Note: on branch `v6` the type definitions live under `src/*.d.ts` (the `types/` paths given in the
task return HTTP 404 on GitHub); the published npm package copies them to `types/`.

Date researched: 2026-09-08
