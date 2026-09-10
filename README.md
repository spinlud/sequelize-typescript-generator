# sequelize-typescript-generator
> Generates TypeScript [Sequelize](https://www.npmjs.com/package/sequelize) models directly from an existing database. Emits framework-free native models by default, with [`sequelize-typescript`](https://www.npmjs.com/package/sequelize-typescript) decorated classes available as an opt-in format.

> Upgrading from 12.x? See the [migration guide](docs/migration/12-to-13.md).

## Table of Contents

<!-- toc -->

* [Tested databases](#tested-databases)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [CLI usage](#cli-usage)
* [Output formats](#output-formats)
    * [Native format](#native-format)
    * [Decorators format](#decorators-format)
* [Programmatic usage](#programmatic-usage)
* [Strict mode](#strict-mode)
* [Transform case](#transform-case)
* [Associations](#associations)
    * [Cardinality](#cardinality)
    * [Skipped foreign keys](#skipped-foreign-keys)
    * [Alias rule](#alias-rule)
    * [Generated associations](#generated-associations)
    * [Disabling discovery](#disabling-discovery)
    * [Associations file](#associations-file)
        * [One to One](#one-to-one)
        * [One to Many](#one-to-many)
        * [Many to Many](#many-to-many)
* [Lint](#lint)

<!-- toc stop -->

## Tested databases

This library is tested on the following databases:

- Postgres (11, 14, 16)
- Mysql (5, 8)
- MariaDB (10, 11)
- SQL Server (2019, 2022)
- SQLite (3)

## Prerequisites
See [sequelize-typescript installation](https://www.npmjs.com/package/sequelize-typescript#installation).

You should also install the specific driver library for your database, see 
[sequelize documentation](https://sequelize.org/v5/manual/getting-started.html):
```shell
npm install -S pg pg-hstore # Postgres
npm install -S mysql2 # MySQL
npm install -S mariadb # MariaDB
npm install -S @vscode/sqlite3 # SQLite
npm install -S tedious # Microsoft SQL Server
```

## Installation
This package is ESM-only and requires Node `>=22.13`. CommonJS consumers can load it through
`require()` of the ESM entry. SQLite support requires the `@vscode/sqlite3` driver installed in
your project (see [Prerequisites](#prerequisites)).

Local install
```shell
npm install -S sequelize-typescript-generator
```

Global install (you must install also the peer dependencies globally, see [Prerequisites](#prerequisites)):
```shell
npm install -g sequelize-typescript-generator
```

NB -  Linting models globally is not supported (`eslint` library does not support global plugins). 
If you plan to use the library globally and you want your models to be automatically linted, you need
to install the following packages locally:

```shell
npm install -S typescript eslint @typescript-eslint/parser
```

## CLI usage
To use the library locally, install `npx` if not already available in the path:
```shell 
npm install -g npx
```

Then to get usage information type:
```shell 
npx stg --help
```

For a global usage simply type:
```shell 
stg --help
```

```shell
Usage: stg -D <dialect> -d [database] -u [username] -x [password] -h [host] -p
[port] -o [out-dir] -s [schema] -a [associations-file]-t [tables] -T
[skip-tables] -i [indices] -C [case] -S [storage] -L [lint-file] -l [ssl] -r
[protocol] -c [clean] -F [format] --no-associations

Options:
  --help                      Show help                                [boolean]
  --version                   Show version number                      [boolean]
  -h, --host                  Database IP/hostname                      [string]
  -p, --port                  Database port. Defaults:
                              - MySQL/MariaDB: 3306
                              - Postgres: 5432
                              - MSSQL: 1433                             [number]
  -d, --database              Database name                             [string]
  -s, --schema                Schema name (Postgres and SQL Server). Default:
                              - public                                  [string]
  -D, --dialect               Dialect:
                              - postgres
                              - mysql
                              - mariadb
                              - sqlite
                              - mssql                        [string] [required]
  -u, --username              Database username                         [string]
  -x, --password              Database password                         [string]
  -t, --tables                Comma-separated names of tables to process[string]
  -T, --skip-tables           Comma-separated names of tables to skip   [string]
  -i, --indices               Include index annotations in the generated models
                                                                       [boolean]
  -o, --out-dir               Output directory. Default:
                              - output-models                           [string]
  -c, --clean                 Clean output directory before running    [boolean]
  -m, --timestamps            Add default timestamps to tables         [boolean]
  -P, --paranoid              Emit paranoid table options for tables
                              with a deleted_at or deletedAt column.
                              Requires --timestamps.                    [boolean]
  -C, --case                  Transform tables and fields names
                              with one of the following cases:
                              - underscore
                              - camel
                              - upper
                              - lower
                              - pascal
                              - const
                              You can also specify a different
                              case for model and columns using
                              the following format:
                              <model case>:<column case>
                                                                        [string]
  -S, --storage               SQLite storage. Default:
                              - memory                                  [string]
  -L, --lint-file             ES Lint file path                         [string]
  -l, --ssl                   Enable SSL                               [boolean]
  -r, --protocol              Protocol used: Default:
                              - tcp                                     [string]
  -a, --associations-file     Associations file path                    [string]
  -g, --logs                  Enable Sequelize logs                    [boolean]
  -n, --dialect-options       Dialect native options passed as json string.
                                                                        [string]
  -f, --dialect-options-file  Dialect native options passed as json file path.
                                                                        [string]
  -F, --format                Output format:
                              - native: plain Sequelize classes with declare
                                fields, Model.init and an initModels wiring
                                file (default)
                              - decorators: sequelize-typescript decorators
                                (requires sequelize-typescript in the target
                                project)
                                              [string] [choices: "native",
                                              "decorators"] [default: "native"]
  -R, --no-strict             Disable strict typescript class declaration
                              (decorators format only).                [boolean]
  -V, --no-views              Disable view generation. Available for: MySQL and MariaDB.
                                                                       [boolean]
  --associations              Discover one-to-one and one-to-many associations
                              from foreign keys. Use --no-associations to
                              disable.                   [boolean] [default: true]
```

Local usage example:
```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --indices --dialect-options-file path/to/dialectOptions.json --case camel --out-dir models --clean 
```

Global usage example:
```shell
stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --indices --dialect-options-file path/to/dialectOptions.json --case camel --out-dir models --clean 
```

## Output formats
The generator emits models in one of two formats, selected with `-F` / `--format` (or the `format`
option in [programmatic usage](#programmatic-usage)):

- `native` (default): framework-free [`sequelize`](https://www.npmjs.com/package/sequelize) models.
- `decorators`: [`sequelize-typescript`](https://www.npmjs.com/package/sequelize-typescript) decorated classes.

`native` is the default. Pass `--format decorators` (or `format: 'decorators'` programmatically) to emit
decorated classes instead.

### Native format
Each model is a plain `sequelize` class. Attributes are typed with `InferAttributes` and
`InferCreationAttributes`, `declare`d rather than assigned, and wrapped with `CreationOptional`,
`ForeignKey` and `NonAttribute` where appropriate. Every model exposes a `static initModel(sequelize)`
method instead of decorator metadata:

```ts
import {
	Association, BelongsToCreateAssociationMixin, BelongsToGetAssociationMixin, BelongsToSetAssociationMixin, CreationOptional, DataTypes, ForeignKey, InferAttributes, InferCreationAttributes, Model, NonAttribute, Sequelize 
} from "sequelize";
import type { races } from "./races";

export class units extends Model<InferAttributes<units>, InferCreationAttributes<units>> {

	declare unit_id: CreationOptional<number | null>;

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

Alongside the model files the generator emits an `initModels.ts` wiring file and an `index.ts` barrel.
The wiring file calls every model's `initModel` and declares all associations, and exports a `Models`
type derived from its return value:

```ts
import { Sequelize } from "sequelize";
import { races } from "./races";
import { units } from "./units";
// ... other model imports

export function initModels(sequelize: Sequelize) {
	races.initModel(sequelize);
	units.initModel(sequelize);
	// ... other initModel calls
	races.hasMany(units, {
		as: "units",
		foreignKey: "race_id",
		sourceKey: "race_id"
	});
	units.belongsTo(races, {
		as: "race",
		foreignKey: "race_id",
		targetKey: "race_id"
	});
	// ... other associations
	return {
		races,
		units
		// ... other models
	};
}

export type Models = ReturnType<typeof initModels>;
```

Wire the models against a `Sequelize` instance and use them straight away:

```ts
import { Sequelize } from "sequelize";
import { initModels } from "./models/initModels";

const sequelize = new Sequelize("myDatabase", "myUsername", "myPassword", { dialect: "mysql" });

const models = initModels(sequelize);

const units = await models.units.findAll({ include: models.races });
```

`initModels`, the `Models` type and the `static initModel` methods belong to the native format. Native
models depend on `sequelize` alone; `sequelize-typescript` is not required.

### Decorators format
Pass `--format decorators` to emit `sequelize-typescript` decorated classes (the output shown in the
[Associations](#associations) examples below). This format requires `sequelize-typescript` to be
installed in the target project; if it cannot be resolved from the output directory a warning is
printed (the generator never throws for this). Register the generated models with `sequelize-typescript`
rather than a wiring file:

```ts
import { Sequelize } from "sequelize-typescript";
import { units } from "./models/units";
import { races } from "./models/races";

const sequelize = new Sequelize("myDatabase", "myUsername", "myPassword", { dialect: "mysql" });

sequelize.addModels([units, races]);
```

## Programmatic usage
You can use the library programmatically, as shown in the following example:

```ts
import { IConfig, ModelBuilder, createDialect } from 'sequelize-typescript-generator';

(async () => {
    const config: IConfig = {
        connection: {
            dialect: 'mysql',
            database: 'myDatabase',
            username: 'myUsername',
            password: 'myPassword'
        },
        metadata: {
            indices: true,
            case: 'CAMEL',
        },
        output: {
            clean: true,
            outDir: 'models'
        },
        format: 'native',
    };

    const dialect = createDialect('mysql');

    const builder = new ModelBuilder(config, dialect);

    try {
        await builder.build();
    }
    catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
```

The `format` option accepts `'native'` (default) or `'decorators'` and mirrors the `--format` CLI flag;
omit it to get the native format. See [Output formats](#output-formats) for the difference between them.

## Strict mode
Strict mode applies to the [decorators format](#decorators-format). It controls whether the generated
decorated classes declare an explicit attributes interface and implement it on the model class.

By default strict mode will be used for models class declaration:

`STRICT ENABLED`
```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasOne 
} from "sequelize-typescript";
import { passport } from "./passport";

export interface personAttributes {
    person_id: number;
    name: string;
    passport_id: number;
}

@Table({
	tableName: "person",
	timestamps: false 
})
export class person extends Model<personAttributes, personAttributes> implements personAttributes {

    @Column({
    	primaryKey: true,
    	type: DataType.INTEGER 
    })
    @Index({
    	name: "PRIMARY",
    	using: "BTREE",
    	order: "ASC",
    	unique: true 
    })
    person_id!: number;

    @Column({
    	type: DataType.STRING(80) 
    })
    name!: string;

    @Column({
    	type: DataType.INTEGER 
    })
    passport_id!: number;

    @HasOne(() => passport, {
    	sourceKey: "person_id" 
    })
    passport?: passport;

}
```

You can disable strict mode from both CLI or programmatically:

```shell
npx stg -D mysql -d myDatabase --no-strict  
```

```ts
const config: IConfig = {
    connection: {
        dialect: 'mysql',
        database: 'myDatabase',
        username: 'myUsername',
        password: 'myPassword'
    },
    metadata: {
        indices: true,
        case: 'CAMEL',
    },
    output: {
        clean: true,
        outDir: 'models'
    },
    strict: false,
};
```

`STRICT DISABLED`
```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasOne 
} from "sequelize-typescript";
import { passport } from "./passport";

@Table({
	tableName: "person",
	timestamps: false 
})
export class person extends Model {

    @Column({
    	primaryKey: true,
    	type: DataType.INTEGER 
    })
    @Index({
    	name: "PRIMARY",
    	using: "BTREE",
    	order: "ASC",
    	unique: true 
    })
    person_id!: number;

    @Column({
    	type: DataType.STRING(80) 
    })
    name!: string;

    @Column({
    	type: DataType.INTEGER 
    })
    passport_id!: number;

    @HasOne(() => passport, {
    	sourceKey: "person_id" 
    })
    passport?: passport;

}
```


## Transform case
You can transform table name and fields with one of the following cases:

- underscore
- camel
- upper
- lower
- pascal
- const

You can provide a different case for the model name and columns:

```shell
npx stg -D mysql --case const:camel 
```

```ts
const config: IConfig = {
    // [...]
    metadata: {        
        case: {
            model: 'CONST',
            column: 'CAMEL'    
        },
    },
    // [...]
};
```

You can also provide your custom transformer function (code only):

```ts
const config: IConfig = {
    // [...]
    metadata: {        
        case: (value, target) => {
            // Model transformer
            if (target === 'model') {
                return value.toUpperCase();
            }
    
            // Column transformer
            return value.toLowerCase();
        }
    },
    // [...]
};
```

NB: please note that currently case transformation is not supported for non ASCII strings.

## Associations
Associations are discovered automatically from the foreign keys found in your schema, so in most cases you get
one-to-one and one-to-many relations in the generated models without any extra configuration. Discovery is on by
default; disable it with `--no-associations`. You can still declare associations explicitly in an
[associations file](#associations-file), which is applied on top of whatever was discovered.

### Cardinality
Each foreign key produces a `BelongsTo` on the table that holds the foreign key and a matching relation on the
referenced table:

- **One to one** when the foreign key column is the single-column primary key of its table, or is covered by a
single-column unique constraint or unique index. The referenced table gets a `HasOne`.
- **One to many** in every other case. The referenced table gets a `HasMany`.

Many-to-many is never inferred. Junction tables are generated as plain models, and you declare the
many-to-many relation yourself in the [associations file](#associations-file).

### Skipped foreign keys
Some foreign keys cannot be turned into a Sequelize association. In these cases the column is generated as a
plain attribute and a single warning is printed:

- **Composite foreign keys** that span more than one column. Sequelize associations need a single column.
- **Cross-schema foreign keys** whose referenced table lives in another schema.
- **Foreign keys to a table that is not generated**, for example one excluded with `--skip-tables` or by a
`--tables` filter.

### Alias rule
Every association is exposed under an alias, used as the class property name and in `include` queries.

When a single foreign key links the two tables (unambiguous):

- the `BelongsTo` side uses the singular of the target model;
- the reverse side uses the plural of the source model, or its singular for a one-to-one relation.

For example `units.race_id → races` gives `units.race` and `races.units`, and the one-to-one
`profiles.person_id → person` gives `profiles.person` and `person.profile`.

When two foreign keys point at the same table, or a table references itself (ambiguous), the alias is derived
from the foreign key column instead. The `_id`, `_fk`, `Id` and `Fk` suffixes are stripped for the `BelongsTo`
side, and the reverse side is the camelCased composition of that stem and the source model name. For example the
self-referencing `employees.manager_id → employees` gives `employees.manager` and `employees.managerEmployees`,
and a `books` table with `author_id` and `editor_id` both referencing `authors` gives `books.author`,
`books.editor`, `authors.authorBooks` and `authors.editorBooks`. When the column has no strippable suffix the
alias falls back to the target model combined with the column name. Aliases that would collide with an existing
field or another alias on the same model receive a numeric suffix.

Aliases follow `--case`: with a case set they are transformed like column names. Without `--case`, singular and
plural aliases keep the database spelling and only composed aliases are camelCased.

The alias surfaces as the `as` option on the association and as the model property that exposes the related
record. For the one-to-one `profiles.person_id → person` relation (giving `profiles.person` and `person.profile`):

**Native** — the alias is the `as` option in `initModels.ts` and the name of the `NonAttribute` property on each
model:

```ts
person.hasOne(profiles, {
	as: "profile",
	foreignKey: "person_id",
	sourceKey: "person_id",
	onDelete: "CASCADE",
	onUpdate: "CASCADE"
});
profiles.belongsTo(person, {
	as: "person",
	foreignKey: "person_id",
	targetKey: "person_id",
	onDelete: "CASCADE",
	onUpdate: "CASCADE"
});
```

**Decorators** — the alias is the `as` option on the decorator and the name of the decorated property:

```ts
// person.ts
@HasOne(() => profiles, {
	as: "profile",
	foreignKey: "person_id",
	sourceKey: "person_id",
	onDelete: "CASCADE",
	onUpdate: "CASCADE" 
})
profile?: profiles;
```

```ts
// profiles.ts
@BelongsTo(() => person, {
	as: "person",
	foreignKey: "person_id",
	targetKey: "person_id",
	onDelete: "CASCADE",
	onUpdate: "CASCADE" 
})
person?: person;
```

### Generated associations
For each discovered foreign key the generator wires both sides of the relation. Each side carries the resolved
`as` alias, the `foreignKey`, and the referenced column as `targetKey` (owning side) or `sourceKey` (inverse
side); `onDelete`/`onUpdate` are added whenever the referential action is not `NO ACTION`.

**Native** — the foreign key column is typed with `ForeignKey<...>`, each side exposes a typed `NonAttribute`
property, and the relation is wired in `initModels.ts`:

```ts
// units.ts
declare race_id: ForeignKey<races["race_id"]>;
declare race?: NonAttribute<races>;
// races.ts
declare units?: NonAttribute<units[]>;
```

```ts
// initModels.ts
races.hasMany(units, {
	as: "units",
	foreignKey: "race_id",
	sourceKey: "race_id"
});
units.belongsTo(races, {
	as: "race",
	foreignKey: "race_id",
	targetKey: "race_id"
});
```

**Decorators** — the foreign key column keeps its `@ForeignKey(() => Target)` decorator, and the association is
emitted with `@BelongsTo`, `@HasOne` or `@HasMany`:

```ts
// units.ts
@ForeignKey(() => races)
@Column({
	type: DataType.INTEGER 
})
race_id!: number;

@BelongsTo(() => races)
race?: races;
```

```ts
// races.ts
@HasMany(() => units, {
	sourceKey: "race_id" 
})
units?: units[];
```

### Disabling discovery
Pass `--no-associations` to skip discovery entirely. Foreign key columns still get their `@ForeignKey`
decorator, and an [associations file](#associations-file) is still applied if provided.

```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --no-associations --out-dir models --clean 
```

Programmatically, set `associations: false` in the metadata:

```ts
const config: IConfig = {
    connection: {
        dialect: 'mysql',
        database: 'myDatabase',
        username: 'myUsername',
        password: 'myPassword'
    },
    metadata: {
        indices: true,
        associations: false, // Disable automatic association discovery
    },
    output: {
        clean: true,
        outDir: 'models'
    },
};
```

### Associations file
You can declare associations explicitly in a csv-like text file, let's call it `associations.csv` (but you can
call it however you want). Put an entry for each association you want to define. The following associations are
supported:

- `1:1`
- `1:N`
- `N:N`

Some rules for the associations file:

- Names of tables and columns in the associations file must be the native names on the database, not the 
transformed names generated when using a custom case transformation with the flag `--case`.
- Only `,` separator is supported.
- Do not use enclosing quotes.

Note that fields generated by associations file entries will be pluralized or singularized based on cardinality.

The associations file is applied on top of the discovered associations. A row that names the same source table
and foreign key column replaces the association discovered for that column; any other discovered associations
are kept. If a file entry ends up with the same alias as a discovered association on the same model, the
discovered one is dropped in favour of the file entry and a warning is printed. Use this to override discovery
where you need a different shape, and to add the many-to-many relations that are never inferred.

#### One to One
In the associations file include an entry with the following structure:
```
1:1, left_table_key, right_table_key, left_table, right_table
```

where:

- `1:1` is the relation cardinality
- `left_table_key` is the join column of the left table
- `right_table_key` is the join column of the right table
- `left_table` is the name of the left table
- `right_table` is the name of the right table

For example given the following tables:

```sql
CREATE TABLE person
(
    person_id           INT             PRIMARY KEY,
    name                VARCHAR(80)     NOT NULL,
    passport_id         INT             NOT NULL
);

CREATE TABLE passport
(
    passport_id         INT             PRIMARY KEY,
    code                VARCHAR(80)     NOT NULL
);
```

Define a `1:1` association with the following entry in the associations file:

```
1:1, passport_id, passport_id, person, passport
```

Then pass the associations file path to the `cli`:
```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --associations-file path/to/associations.csv --out-dir models --clean 
```

Global:
```shell
stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --associations-file path/to/associations.csv --out-dir models --clean 
```

Or programmatically:

```ts
import { IConfig, ModelBuilder, createDialect } from 'sequelize-typescript-generator';

(async () => {
    const config: IConfig = {
        connection: {
            dialect: 'mysql',
            database: 'myDatabase',
            username: 'myUsername',
            password: 'myPassword'
        },
        metadata: {
            indices: false,
            associationsFile: 'path/to/associations.csv',            
        },
        output: {
            clean: true,
            outDir: 'models'
        }
    };

    const dialect = createDialect('mysql');

    const builder = new ModelBuilder(config, dialect);

    try {
        await builder.build();
    }
    catch(err) {
        console.error(err);
        process.exit(1);
    }
})();
```

This will generate the following models.

**Native** — `person` gets a `HasOne` and `passport` gets the `BelongsTo`, wired in `initModels.ts`
(association mixins and the `static initModel` body are trimmed for brevity):

```ts
// person.ts
export class person extends Model<InferAttributes<person>, InferCreationAttributes<person>> {

	declare person_id: CreationOptional<number | null>;

	declare name: string;

	declare passport_id: number;

	declare passport?: NonAttribute<passport>;

	declare static associations: {
		passport: Association<person, passport>;
	};

	// static initModel(sequelize) ...
}
```

```ts
// passport.ts
export class passport extends Model<InferAttributes<passport>, InferCreationAttributes<passport>> {

	declare passport_id: ForeignKey<person["person_id"] | null>;

	declare code: string;

	declare person?: NonAttribute<person>;

	declare static associations: {
		person: Association<passport, person>;
	};

	// static initModel(sequelize) ...
}
```

```ts
// initModels.ts
person.hasOne(passport, {
	as: "passport",
	foreignKey: "passport_id",
	sourceKey: "passport_id"
});
passport.belongsTo(person, {
	as: "person",
	foreignKey: "passport_id"
});
```

**Decorators**:

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasOne 
} from "sequelize-typescript";
import { passport } from "./passport";

export interface personAttributes {
	person_id?: number;
	name: string;
	passport_id: number;
}

@Table({
	tableName: "person",
	timestamps: false 
})
export class person extends Model<personAttributes, personAttributes> implements personAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_person_1",
		unique: true 
	})
	person_id?: number;

	@Column({
		type: DataType.STRING 
	})
	name!: string;

	@Column({
		type: DataType.INTEGER 
	})
	passport_id!: number;

	@HasOne(() => passport, {
		sourceKey: "passport_id" 
	})
	passport?: passport;

}
```

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsTo 
} from "sequelize-typescript";
import { person } from "./person";

export interface passportAttributes {
	passport_id?: number;
	code: string;
}

@Table({
	tableName: "passport",
	timestamps: false 
})
export class passport extends Model<passportAttributes, passportAttributes> implements passportAttributes {

	@ForeignKey(() => person)
	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_passport_1",
		unique: true 
	})
	passport_id?: number;

	@Column({
		type: DataType.STRING 
	})
	code!: string;

	@BelongsTo(() => person)
	person?: person;

}
```

#### One to Many

```
1:N, left_table_key, right_table_key, left_table, right_table
```

where:

- `1:N` is the relation cardinality
- `left_table_key` is the join column of the left table
- `right_table_key` is the join column of the right table
- `left_table` is the name of the left table
- `right_table` is the name of the right table

For example given the following tables:

```sql
CREATE TABLE races
(
    race_id             INT             PRIMARY KEY,
    race_name           VARCHAR(80)     NOT NULL
);

CREATE TABLE units
(
    unit_id             INT             PRIMARY KEY,
    unit_name           VARCHAR(80)     NOT NULL,
    race_id             INT             NOT NULL
);
```

Define a `1:N` association with the following entry in the associations file:

```
1:N, race_id, race_id, races, units
```

Build models:

```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --indices --associations-file path/to/associations.csv --out-dir models --clean 
```

This will generate the following models.

**Native** — `races` gets a `HasMany` and `units` gets the `BelongsTo`, wired in `initModels.ts`
(association mixins and the `static initModel` body are trimmed for brevity):

```ts
// races.ts
export class races extends Model<InferAttributes<races>, InferCreationAttributes<races>> {

	declare race_id: CreationOptional<number | null>;

	declare race_name: string;

	declare units?: NonAttribute<units[]>;

	declare static associations: {
		units: Association<races, units>;
	};

	// static initModel(sequelize) ...
}
```

```ts
// units.ts
export class units extends Model<InferAttributes<units>, InferCreationAttributes<units>> {

	declare unit_id: CreationOptional<number | null>;

	declare unit_name: string;

	declare race_id: ForeignKey<races["race_id"]>;

	declare race?: NonAttribute<races>;

	declare static associations: {
		race: Association<units, races>;
	};

	// static initModel(sequelize) ...
}
```

```ts
// initModels.ts
races.hasMany(units, {
	as: "units",
	foreignKey: "race_id",
	sourceKey: "race_id"
});
units.belongsTo(races, {
	as: "race",
	foreignKey: "race_id",
	targetKey: "race_id"
});
```

**Decorators**:

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasMany 
} from "sequelize-typescript";
import { units } from "./units";

export interface racesAttributes {
	race_id?: number;
	race_name: string;
}

@Table({
	tableName: "races",
	timestamps: false 
})
export class races extends Model<racesAttributes, racesAttributes> implements racesAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_races_1",
		unique: true 
	})
	race_id?: number;

	@Column({
		type: DataType.STRING 
	})
	race_name!: string;

	@HasMany(() => units, {
		sourceKey: "race_id" 
	})
	units?: units[];

}
```

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsTo 
} from "sequelize-typescript";
import { races } from "./races";

export interface unitsAttributes {
	unit_id?: number;
	unit_name: string;
	race_id: number;
}

@Table({
	tableName: "units",
	timestamps: false 
})
export class units extends Model<unitsAttributes, unitsAttributes> implements unitsAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_units_1",
		unique: true 
	})
	unit_id?: number;

	@Column({
		type: DataType.STRING 
	})
	unit_name!: string;

	@ForeignKey(() => races)
	@Column({
		type: DataType.INTEGER 
	})
	race_id!: number;

	@BelongsTo(() => races)
	race?: races;

}
```

#### Many to Many
In the associations file include an entry with the following structure:
```
N:N, left_table_key, right_table_key, left_table, right_table, join_table
```

where:

- `N:N` is the relation cardinality
- `left_table_key` is the join column of the left table
- `right_table_key` is the join column of the right table
- `left_table` is the name of the left table
- `right_table` is the name of the right table
- `join_table` is the name of the join table

For example given the following tables:

```sql
CREATE TABLE authors
(
    author_id       INT             primary key,
    full_name       VARCHAR(80)     not null
);

CREATE TABLE books
(
    book_id         INT             PRIMARY KEY,
    title           VARCHAR(80)     not null
);

CREATE TABLE authors_books
(
    author_id       INT             not null,
    book_id         INT             not null,
    PRIMARY KEY (author_id, book_id)
);
```

Define an `N:N` association with the following entry in the associations file:

```
N:N, author_id, book_id, authors, books, authors_books
```

Build models:

```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --indices --associations-file path/to/associations.csv --out-dir models --clean 
```

This will generate the following models.

**Native** — `authors` and `books` each get a `BelongsToMany` through the `authors_books` junction model,
wired in `initModels.ts` (association mixins and the `static initModel` bodies of `authors`/`books` are
trimmed for brevity; the junction model is shown in full):

```ts
// authors.ts
export class authors extends Model<InferAttributes<authors>, InferCreationAttributes<authors>> {

	declare author_id: CreationOptional<number | null>;

	declare full_name: string;

	declare books?: NonAttribute<books[]>;

	declare static associations: {
		books: Association<authors, books>;
	};

	// static initModel(sequelize) ...
}
```

```ts
// books.ts
export class books extends Model<InferAttributes<books>, InferCreationAttributes<books>> {

	declare book_id: CreationOptional<number | null>;

	declare title: string;

	declare authors?: NonAttribute<authors[]>;

	declare static associations: {
		authors: Association<books, authors>;
	};

	// static initModel(sequelize) ...
}
```

```ts
// authors_books.ts
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
			author_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			},
			book_id: {
				type: DataTypes.INTEGER,
				allowNull: false
			}
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

```ts
// initModels.ts
authors.belongsToMany(books, {
	as: "books",
	through: authors_books,
	foreignKey: "author_id",
	otherKey: "book_id"
});
books.belongsToMany(authors, {
	as: "authors",
	through: authors_books,
	foreignKey: "book_id",
	otherKey: "author_id"
});
```

**Decorators**:

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsToMany 
} from "sequelize-typescript";
import { books } from "./books";
import { authors_books } from "./authors_books";

export interface authorsAttributes {
	author_id?: number;
	full_name: string;
}

@Table({
	tableName: "authors",
	timestamps: false 
})
export class authors extends Model<authorsAttributes, authorsAttributes> implements authorsAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_authors_1",
		unique: true 
	})
	author_id?: number;

	@Column({
		type: DataType.STRING 
	})
	full_name!: string;

	@BelongsToMany(() => books, () => authors_books)
	books?: books[];

}
```

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsToMany 
} from "sequelize-typescript";
import { authors } from "./authors";
import { authors_books } from "./authors_books";

export interface booksAttributes {
	book_id?: number;
	title: string;
}

@Table({
	tableName: "books",
	timestamps: false 
})
export class books extends Model<booksAttributes, booksAttributes> implements booksAttributes {

	@Column({
		primaryKey: true,
		autoIncrement: true,
		allowNull: true,
		type: DataType.INTEGER 
	})
	@Index({
		name: "sqlite_autoindex_books_1",
		unique: true 
	})
	book_id?: number;

	@Column({
		type: DataType.STRING 
	})
	title!: string;

	@BelongsToMany(() => authors, () => authors_books)
	authors?: authors[];

}
```

```ts
import {
	Model, Table, Column, DataType, Index, Sequelize, ForeignKey 
} from "sequelize-typescript";
import { authors } from "./authors";
import { books } from "./books";

export interface authors_booksAttributes {
	author_id: number;
	book_id: number;
}

@Table({
	tableName: "authors_books",
	timestamps: false 
})
export class authors_books extends Model<authors_booksAttributes, authors_booksAttributes> implements authors_booksAttributes {

	@ForeignKey(() => authors)
	@Column({
		type: DataType.INTEGER 
	})
	author_id!: number;

	@ForeignKey(() => books)
	@Column({
		type: DataType.INTEGER 
	})
	book_id!: number;

}
```

## Lint
By default each generated model will be linted with a predefined ESLint flat config to improve readability:

```ts
import stylistic from '@stylistic/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export const eslintDefaultConfig = [
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2019,
                sourceType: 'module',
            },
        },
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            '@stylistic/padded-blocks': ['error', { blocks: 'never', classes: 'always', switches: 'always' }],
            '@stylistic/lines-between-class-members': ['error', 'always'],
            '@stylistic/object-curly-newline': ['error', {
                'ObjectExpression': 'always',
                'ObjectPattern': { 'multiline': true },
                'ImportDeclaration': { 'multiline': true, 'minProperties': 3 },
                'ExportDeclaration': { 'multiline': true, 'minProperties': 3 },
            }],
            '@stylistic/object-property-newline': ['error'],
            '@stylistic/indent': ['error', 'tab'],
        },
    },
];
```

You can provide your own rules by passing a config file to `--lint-file` / `-L`. Only ESLint flat config files are
accepted: `.mjs`, `.js`, or `.cjs` modules that export a config array. Legacy `.eslintrc*` files, and configs using
`extends`, `env`, or a string `parser`, are rejected — see the
[ESLint flat config migration guide](https://eslint.org/docs/latest/use/configure/migration-guide).

A minimal flat config looks like this:

```js
import stylistic from '@stylistic/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
    {
        files: ['**/*.ts', '**/*.tsx'],
        languageOptions: {
            parser,
            parserOptions: { ecmaVersion: 2019, sourceType: 'module' },
        },
        plugins: { '@stylistic': stylistic },
        rules: { '@stylistic/indent': ['error', 'tab'] },
    },
];
```

Pass it to the `cli` like the following:
```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --lint-file path/to/flat.config.mjs --out-dir models --clean 
```

Globally:
```shell
stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --lint-file path/to/flat.config.mjs --out-dir models --clean 
```

Or you can pass `eslint` options programmatically:

```ts
import { IConfig, ModelBuilder, createDialect } from 'sequelize-typescript-generator';

(async () => {
    const config: IConfig = {
        connection: {
            dialect: 'mysql',
            database: 'myDatabase',
            username: 'myUsername',
            password: 'myPassword'
        },        
        lintOptions: {
            configFile: 'path/to/lint-file',
            fix: true,
        },
        output: {
            clean: true,
            outDir: 'my-models',
        },
    };

    const dialect = createDialect('mysql');

    const builder = new ModelBuilder(config, dialect);

    await builder.build();
})();
```

## License
[MIT License](http://en.wikipedia.org/wiki/MIT_License)
