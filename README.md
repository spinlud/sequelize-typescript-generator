# sequelize-typescript-generator
> Automatically generates typescript models compatible with [sequelize-typescript](https://www.npmjs.com/package/sequelize-typescript) library directly from your source database.  

## Table of Contents

<!-- toc -->

* [Supported databases](#supported-databases)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [CLI usage](#cli-usage)
* [Programmatic usage](#programmatic-usage)
* [Strict mode](#strict-mode)
* [Transform case](#transform-case)
* [Associations](#associations)
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
npm install -S sqlite3 # SQLite
npm install -S tedious # Microsoft SQL Server
```

## Installation
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
[protocol] -c [clean]

Options:
  --help                      Show help                                [boolean]
  --version                   Show version number                      [boolean]
  -h, --host                  Database IP/hostname                      [string]
  -p, --port                  Database port. Defaults:
                              - MySQL/MariaDB: 3306
                              - Postgres: 5432
                              - MSSQL: 1433                             [number]
  -d, --database              Database name                             [string]
  -s, --schema                Schema name (Postgres only). Default:
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
  -R, --no-strict             Disable strict typescript class declaration.
                                                                       [boolean]    
  -V, --no-views              Disable view generation. Available for: MySQL and MariaDB.
                                                                       [boolean]                                                                      
```

Local usage example:
```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --indices --dialect-options-file path/to/dialectOptions.json --case camel --out-dir models --clean 
```

Global usage example:
```shell
stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --indices --dialect-options-file path/to/dialectOptions.json --case camel --out-dir models --clean 
```

## Programmatic usage
You can use the library programmatically, as shown in the following example:

```ts
import { IConfig, ModelBuilder, DialectMySQL } from 'sequelize-typescript-generator';

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
        strict: true,
    };

    const dialect = new DialectMySQL();

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

## Strict mode
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
Including associations in the generated models requires a bit of manual work unfortunately, but hopefully 
it will buy you some time instead of defining them from scratch.  
  
First you have to define a csv-like text file, let's call it `associations.csv` (but you can call it however you want).   In this file you have to put an entry for each association you want to define. 
The following associations are supported:

- `1:1`
- `1:N`
- `N:N`

Some rules for the association file:

- Names of tables and columns in the associations file must be the native names on the database, not the 
transformed names generated when using a custom case transformation with the flag `--case`.
- Only `,` separator is supported.
- Do not use enclosing quotes.

Note that fields generated by associations will be pluralized or singularized based on cardinality. 

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
import { IConfig, ModelBuilder, DialectMySQL } from 'sequelize-typescript-generator';

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

    const dialect = new DialectMySQL();

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

This will generate the following models:

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
  passport_id: number;
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
    type: DataType.INTEGER
  })
  passport_id!: number;

  @Column({
    type: DataType.STRING(80)
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

This will generate the following models:

```ts
import {
  Model, Table, Column, DataType, Index, Sequelize, ForeignKey, HasMany
} from "sequelize-typescript";
import { units } from "./units";

export interface racesAttributes {
  race_id: number;
  race_name: string;
}

@Table({
  tableName: "races",
  timestamps: false
})
export class races extends Model<racesAttributes, racesAttributes> implements racesAttributes {

  @Column({
    primaryKey: true,
    type: DataType.INTEGER
  })
  race_id!: number;

  @Column({
    type: DataType.STRING(80)
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
  unit_id: number;
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
    type: DataType.INTEGER
  })
  unit_id!: number;

  @Column({
    type: DataType.STRING(80)
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

This will generate the following models:

```ts
import {
  Model, Table, Column, DataType, Index, Sequelize, ForeignKey, BelongsToMany
} from "sequelize-typescript";
import { books } from "./books";
import { authors_books } from "./authors_books";

export interface authorsAttributes {
  author_id: number;
  full_name: string;
}

@Table({
  tableName: "authors",
  timestamps: false
})
export class authors extends Model<authorsAttributes, authorsAttributes> implements authorsAttributes {

  @Column({
    primaryKey: true,
    type: DataType.INTEGER
  })
  author_id!: number;

  @Column({
    type: DataType.STRING(80)
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
  book_id: number;
  title: string;
}

@Table({
  tableName: "books",
  timestamps: false
})
export class books extends Model<booksAttributes, booksAttributes> implements booksAttributes {

  @Column({
    primaryKey: true,
    type: DataType.INTEGER
  })
  book_id!: number;

  @Column({
    type: DataType.STRING(80)
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
    primaryKey: true,
    type: DataType.INTEGER
  })
  author_id!: number;

  @ForeignKey(() => books)
  @Column({
    primaryKey: true,
    type: DataType.INTEGER
  })
  book_id!: number;

}
```

## Lint
By default each generated model will be linted with a predefined set of rules to improve readability:

```ts
export const eslintDefaultConfig = {
    parser:  '@typescript-eslint/parser',
    parserOptions:  {
        ecmaVersion:  2018,
        sourceType:  'module',
    },
    plugins: [
        '@typescript-eslint',
    ],
    extends:  [],
    rules:  {
        'padded-blocks': ['error', { blocks: 'always', classes: 'always', switches: 'always' }],
        'lines-between-class-members': ['error', 'always' ],
        'object-curly-newline': ['error', {
            'ObjectExpression': 'always',
            'ObjectPattern': { 'multiline': true },
            'ImportDeclaration': { 'multiline': true, 'minProperties': 3 },
            'ExportDeclaration': { 'multiline': true, 'minProperties': 3 },
        }],
        'object-property-newline': ['error'],
        'indent': ['error', 'tab'],
    },
};
```

You can provide your own set of rules that matches your coding style. Just define a file with the linting rules 
(see [eslint](https://www.npmjs.com/package/eslint) docs) and pass it to the `cli` like the following:
```shell
npx stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --lint-file path/to/lint-file --out-dir models --clean 
```

Globally:
```shell
stg -D mysql -h localhost -p 3306 -d myDatabase -u myUsername -x myPassword --lint-file path/to/lint-file --out-dir models --clean 
```

Or you can pass `eslint` options programmatically:

```ts
import { IConfig, ModelBuilder, DialectMySQL } from 'sequelize-typescript-generator';

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

    const dialect = new DialectMySQL();

    const builder = new ModelBuilder(config, dialect);

    await builder.build();
})();
```

## License
[MIT License](http://en.wikipedia.org/wiki/MIT_License)
