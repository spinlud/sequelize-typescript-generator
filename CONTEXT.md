# sequelize-typescript-generator

Domain glossary for the tool that generates TypeScript Sequelize models directly from an existing database schema.

## Language

### Source

**Dialect**:
One supported database engine (Postgres, MySQL, MariaDB, SQL Server, SQLite) together with the adapter that inspects its schema metadata: tables, columns, indexes, foreign keys, and views.
_Avoid_: Engine, driver, database type

### Output

**Model**:
The generated TypeScript class representing one table or view.
_Avoid_: Entity, class, DAO

**Format**:
The output style of the generated models. Has exactly two values, native and decorators, selected with the `--format` option.
_Avoid_: Style, mode, flavour

**Native format**:
Models written as plain Sequelize classes with declared fields and an initialisation call, without any decorator library. Ships with a wiring file. The default format.
_Avoid_: Plain format, classic format

**Decorators format**:
Models written with sequelize-typescript decorators. Requires the consuming project to install sequelize-typescript.
_Avoid_: Annotated format, decorator mode

**Wiring file**:
The file generated in native format that initialises every model against a Sequelize instance and declares all associations between them.
_Avoid_: Index file, bootstrap file, registry

**Strict mode**:
The mode in which a model's attributes are typed by a generated attributes interface. Applies to decorators format only; in native format the class typing already carries the attributes.
_Avoid_: Typed mode

**Case**:
The naming convention applied to model names and column names: underscore, camel, upper, lower, pascal, or const.
_Avoid_: Casing, naming style

### Associations

**Association**:
A relationship between two models: one-to-one, one-to-many, or many-to-many.
_Avoid_: Relation, relationship, link

**Alias**:
The name under which an association is exposed on a model, used both as the class property and in queries that include the related model.
_Avoid_: Association name, relation name, property name

**Junction table**:
A table whose rows link two other tables to express a many-to-many association.
_Avoid_: Join table, pivot table, through table, bridge table

**Associations file**:
The CSV file a user supplies to declare associations explicitly.
_Avoid_: Relations file, mapping file

**Association discovery**:
Automatic derivation of one-to-one and one-to-many associations from foreign keys found in the schema.
_Avoid_: Auto-associations, inference
